#!/usr/bin/env python3
"""ElevenLabs TTS helper for AgentFlow project pods.

Usage:
  elevenlabs.py voices [--lang ru] [--gender male|female]
  elevenlabs.py tts --text "..." --out /workspace/dist/audio/section_1.mp3
                    [--voice auto|adam|rachel|<voice_id>]
                    [--lang ru] [--gender male|female]
                    [--model eleven_multilingual_v2]
                    [--budget_chars 50000]

Env (injected by platform):
  ELEVENLABS_API_KEY    primary auth (header: xi-api-key)

Notes for agents:
  - Prefer this over edge-tts for ANY narration — better quality + multilingual.
  - One voice_id works for ru/en/de/fr/etc via model eleven_multilingual_v2.
  - Daily soft-budget: helper warns at 100k characters/day across all projects
    in the same pod (counted from /workspace/.tools/elevenlabs.log JSON-lines).
  - Per-call --budget_chars hard-caps a single tts call (default 50000).
"""
import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta


KEY = os.environ.get("ELEVENLABS_API_KEY")
BASE = os.environ.get("ELEVENLABS_BASE_URL", "https://api.elevenlabs.io").rstrip("/")
LOG_PATH = "/workspace/.tools/elevenlabs.log"
CACHE_PATH = "/workspace/.tools/elevenlabs.cache"
DAILY_SOFT_LIMIT_CHARS = 100_000


def die(msg, code=1):
    print("[elevenlabs] ERROR: " + msg, file=sys.stderr)
    sys.exit(code)


def require_key():
    if not KEY:
        die("ELEVENLABS_API_KEY env var missing — ask the platform to inject it (runtime-env Secret).")


def log_event(kind, status, *, voice_id=None, chars=0, path=None, extra=None):
    """Append one JSON-line entry to /workspace/.tools/elevenlabs.log so we
    can grep aggregate spend (chars) without re-parsing tool output."""
    try:
        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        rec = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "kind": kind,
            "status": status,
            "voice_id": voice_id,
            "chars": chars,
            "path": path,
        }
        if extra:
            rec.update(extra)
        with open(LOG_PATH, "a") as f:
            f.write(json.dumps(rec) + "\n")
    except Exception as exc:
        print("[elevenlabs] log write failed: " + str(exc), file=sys.stderr)


def daily_chars_used():
    """Sum 'chars' across log lines from the last 24h. Best-effort — unreadable
    log files just return 0 so we don't block on a corrupt log."""
    if not os.path.exists(LOG_PATH):
        return 0
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    total = 0
    try:
        with open(LOG_PATH, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except Exception:
                    continue
                if rec.get("status") != "ok":
                    continue
                ts = rec.get("ts")
                try:
                    when = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except Exception:
                    continue
                if when < cutoff:
                    continue
                total += int(rec.get("chars") or 0)
    except Exception:
        return 0
    return total


def http(method, path, *, json_body=None, raw=False, timeout=180, accept=None):
    require_key()
    url = BASE + path
    headers = {"xi-api-key": KEY}
    if accept:
        headers["Accept"] = accept
    data = None
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read()
            ctype = r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        body = e.read()
        ctype = e.headers.get("Content-Type", "") if e.headers else ""
        if raw:
            return None, ctype, e.code, body
        try:
            return json.loads(body)
        except Exception:
            return {"_http_error": True, "_status": e.code, "_raw": body[:500].decode("utf-8", errors="replace")}
    if raw:
        return body, ctype, 200, None
    try:
        return json.loads(body)
    except Exception:
        return {"_raw": body[:500].decode("utf-8", errors="replace"), "_http_error": True}


def normalize_voice(v):
    """Lift the subset of fields we expose to the coder agent. ElevenLabs
    /v1/voices returns a richer payload; we surface only what's useful for
    voice selection."""
    labels = v.get("labels") or {}
    return {
        "id": v.get("voice_id"),
        "name": v.get("name"),
        "gender": (labels.get("gender") or "").lower() or None,
        "language": (labels.get("language") or labels.get("accent") or "").lower() or None,
        "accent": (labels.get("accent") or "").lower() or None,
        "age": (labels.get("age") or "").lower() or None,
        "use_case": (labels.get("use case") or labels.get("use_case") or "").lower() or None,
        "description": (labels.get("description") or "").lower() or None,
        "category": v.get("category"),
        "preview_url": v.get("preview_url"),
    }


def fetch_voices():
    r = http("GET", "/v1/voices", timeout=30)
    if not isinstance(r, dict) or "voices" not in r:
        die("could not list voices: " + json.dumps(r)[:300])
    return [normalize_voice(v) for v in r["voices"] if isinstance(v, dict)]


# Human-readable language hints inside ElevenLabs labels are inconsistent
# (some say "russian", others "ru"). Map the common ones to a stable token
# we can substring-match against the labels we actually see.
LANG_ALIASES = {
    "ru": ["russian", "ru-ru", "ru"],
    "en": ["english", "en-us", "en-gb", "en"],
    "de": ["german", "de-de", "de"],
    "fr": ["french", "fr-fr", "fr"],
    "es": ["spanish", "es-es", "es-mx", "es"],
    "it": ["italian", "it-it", "it"],
    "pt": ["portuguese", "pt-br", "pt-pt", "pt"],
    "uk": ["ukrainian", "uk-ua", "uk"],
}


def _voice_matches_lang(voice, lang):
    if not lang:
        return True
    aliases = LANG_ALIASES.get(lang.lower(), [lang.lower()])
    haystack = " ".join(
        x for x in (voice.get("language"), voice.get("accent"), voice.get("description")) if x
    )
    if not haystack:
        # ElevenLabs multilingual_v2 voices often lack a language label entirely
        # but still speak any language fine. Don't filter them out.
        return True
    return any(a in haystack for a in aliases)


def _voice_matches_gender(voice, gender):
    if not gender:
        return True
    g = (voice.get("gender") or "").lower()
    if not g:
        return False
    return gender.lower() in g


def _read_cache():
    try:
        with open(CACHE_PATH, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def _write_cache(d):
    try:
        os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
        with open(CACHE_PATH, "w") as f:
            json.dump(d, f)
    except Exception as exc:
        print("[elevenlabs] cache write failed: " + str(exc), file=sys.stderr)


def pick_voice_id(voice_arg, lang, gender, voices_cache=None):
    """Return a concrete voice_id from --voice. Caches auto-picks per
    (lang, gender) tuple so repeated calls in the same project pick the
    same voice (consistent narration across sections)."""
    voices = voices_cache
    if voice_arg and voice_arg != "auto":
        # Concrete id (24+ chars alphanumeric) — pass through.
        if len(voice_arg) >= 20 and voice_arg.replace("-", "").replace("_", "").isalnum():
            return voice_arg
        # Otherwise treat as a name hint.
        if voices is None:
            voices = fetch_voices()
        needle = voice_arg.lower()
        for v in voices:
            if needle in (v.get("name") or "").lower():
                return v["id"]
        die("no voice matches name '%s'. Run 'elevenlabs.py voices' to list ids." % voice_arg)
    # auto
    cache = _read_cache()
    cache_key = "auto::%s::%s" % ((lang or "").lower(), (gender or "").lower())
    if cache_key in cache:
        return cache[cache_key]
    if voices is None:
        voices = fetch_voices()
    # Strategy: ElevenLabs default voices are tagged with their *primary*
    # recording language (mostly "en"), but eleven_multilingual_v2 makes any
    # voice usable for ru/de/fr/etc. So:
    #   1. Try strict (lang AND gender) — gives best match when the user has
    #      cloned a language-specific voice.
    #   2. Fall back to gender-only — for stock voices, gender is the only
    #      meaningful selection criterion since multilingual handles language.
    #   3. Fall back to lang-only.
    #   4. Fall back to anything.
    strict = [
        v for v in voices
        if _voice_matches_lang(v, lang) and _voice_matches_gender(v, gender)
    ]
    candidates = strict
    if not candidates and gender:
        candidates = [v for v in voices if _voice_matches_gender(v, gender)]
    if not candidates and lang:
        candidates = [v for v in voices if _voice_matches_lang(v, lang)]
    if not candidates:
        candidates = voices
    if not candidates:
        die("no voices available from /v1/voices")
    choice = candidates[0]
    cache[cache_key] = choice["id"]
    _write_cache(cache)
    print(
        "[elevenlabs] auto-picked voice id=%s name=%s (lang=%s gender=%s)"
        % (choice["id"], choice.get("name"), lang or "any", gender or "any")
    )
    return choice["id"]


def cmd_voices(args):
    """List voices. --lang/--gender are advisory: we prefer strict matches but
    fall back so the agent never sees an empty array (ElevenLabs default
    voices are mostly tagged 'en' but work for any language via
    eleven_multilingual_v2 — strict lang filter would lie about availability)."""
    voices = fetch_voices()
    if args.lang or args.gender:
        strict = [
            v for v in voices
            if _voice_matches_lang(v, args.lang) and _voice_matches_gender(v, args.gender)
        ]
        if strict:
            voices = strict
        elif args.gender:
            voices = [v for v in voices if _voice_matches_gender(v, args.gender)] or voices
    print(json.dumps(voices, ensure_ascii=False, indent=2))


def cmd_tts(args):
    if not args.text or not args.text.strip():
        die("--text is empty")
    chars = len(args.text)
    if args.budget_chars and chars > args.budget_chars:
        die(
            "--text is %d chars which exceeds --budget_chars %d. "
            "Split into smaller sections or raise --budget_chars."
            % (chars, args.budget_chars)
        )
    used_today = daily_chars_used()
    if used_today + chars > DAILY_SOFT_LIMIT_CHARS:
        print(
            "[elevenlabs] WARN: daily char budget approaching/exceeded "
            "(used %d, +%d this call, soft limit %d)"
            % (used_today, chars, DAILY_SOFT_LIMIT_CHARS),
            file=sys.stderr,
        )
    voice_id = pick_voice_id(args.voice, args.lang, args.gender)
    body = {
        "text": args.text,
        "model_id": args.model,
    }
    if args.voice_settings:
        try:
            body["voice_settings"] = json.loads(args.voice_settings)
        except Exception:
            die("--voice_settings is not valid JSON")
    audio, ctype, status, err = http(
        "POST",
        "/v1/text-to-speech/" + voice_id,
        json_body=body,
        raw=True,
        accept="audio/mpeg",
        timeout=240,
    )
    if audio is None or status != 200:
        try:
            err_text = err.decode("utf-8", errors="replace")[:600] if err else "unknown"
        except Exception:
            err_text = "unknown"
        log_event(
            "tts", "fail", voice_id=voice_id, chars=chars, path=args.out,
            extra={"err": err_text, "http_status": status},
        )
        die("tts request failed (http %s): %s" % (status, err_text))
    if not args.out:
        die("--out is required for tts")
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "wb") as f:
        f.write(audio)
    size = os.path.getsize(args.out)
    digest = hashlib.sha256(audio).hexdigest()[:12]
    print(
        "[elevenlabs] saved -> %s (%d bytes, sha256=%s, voice_id=%s, model=%s)"
        % (args.out, size, digest, voice_id, args.model)
    )
    log_event(
        "tts", "ok", voice_id=voice_id, chars=chars, path=args.out,
        extra={"bytes": size, "model": args.model, "sha256": digest},
    )


def main():
    p = argparse.ArgumentParser(prog="elevenlabs")
    sp = p.add_subparsers(dest="cmd", required=True)

    pv = sp.add_parser("voices", help="list voices as JSON")
    pv.add_argument("--lang", default=None, help="ru | en | de | fr | ...")
    pv.add_argument("--gender", default=None, help="male | female")
    pv.set_defaults(func=cmd_voices)

    pt = sp.add_parser("tts", help="synthesize a single .mp3 from text")
    pt.add_argument("--text", required=True)
    pt.add_argument("--out", required=True, help="local mp3 path, e.g. /workspace/dist/audio/section_1.mp3")
    pt.add_argument("--voice", default="auto",
                    help="auto | adam | rachel | <voice_id>. auto = filter by --lang/--gender")
    pt.add_argument("--lang", default="ru", help="default ru. Used by --voice auto.")
    pt.add_argument("--gender", default=None, help="male | female (used by --voice auto)")
    pt.add_argument("--model", default="eleven_multilingual_v2",
                    help="default eleven_multilingual_v2 (handles ru/en/de/fr/...)")
    pt.add_argument("--voice_settings", default=None,
                    help="optional JSON, e.g. '{\"stability\":0.5,\"similarity_boost\":0.75}'")
    pt.add_argument("--budget_chars", type=int, default=50_000,
                    help="hard cap for THIS call's --text length (default 50000)")
    pt.set_defaults(func=cmd_tts)

    a = p.parse_args()
    a.func(a)


if __name__ == "__main__":
    main()
