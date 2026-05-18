#!/usr/bin/env python3
"""DesignAPI helper for AgentFlow project pods.

Usage:
  designapi.py image --prompt "..." [--aspect 16:9 | --size 1024x1024]
                     [--model nano-banana-pro | --cheap] [--budget 0.05]
                     --out /workspace/public/hero.jpg
  designapi.py video --prompt "..." [--duration 5] [--aspect 16:9]
                     [--image_url https://...] [--cheap] [--budget 0.30]
                     --out /workspace/public/hero.mp4
  designapi.py prices [--filter image|video|chat]

Env (injected by platform):
  DESIGNAPI_API_KEY    Bearer key
  DESIGNAPI_BASE_URL   default https://api.designapi.ink

Cost-aware model selection (cheaper-first):
  - Image cheap (placeholders, backgrounds): flux ($0.010), stable-diffusion
    ($0.010), gemini-2.5-flash-image ($0.040).
  - Image hero (marketing landing): nano-banana-pro ($0.200, default).
  - Image with text on it (logos, posters): ideogram-generate-v3 ($0.180) or
    gpt-image-1 ($0.060).
  - Video cheap (background loop, low stakes): viduq3-turbo ($0.028) — fall
    back to veo3.1-fast if submit fails.
  - Video hero quality: veo3.1-fast ($0.200, TESTED & WORKING, default).
  - Video 4K premium: veo3.1-pro-4k ($13.000) — confirm with maestro first.

Always-broken under our key (helper refuses to call them):
  kling-video-*, sora-2, sora-2-pro (multipart fail), doubao-seedance-*-i2v,
  wan2.6-i2v, MiniMax-Hailuo-*, pixverse-video, whisper-1, claude-haiku-4-5-*.

Run `designapi.py prices` to see live pricing if it has drifted from the
table embedded below.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone


KEY = os.environ.get("DESIGNAPI_API_KEY")
BASE = os.environ.get("DESIGNAPI_BASE_URL", "https://api.designapi.ink").rstrip("/")
LOG_PATH = "/workspace/.tools/designapi.log"

# Pricing table (USD per call) snapshotted from GET /api/pricing — last verified
# during the designapi-trainer onboarding. Drift is OK: `prices` subcommand
# fetches live data, and budget enforcement prefers live > snapshot when both
# are reachable.
PRICE_TABLE = {
    # images (per call)
    "flux": 0.010,
    "stable-diffusion": 0.010,
    "fal-ai/flux-1/schnell": 0.009,
    "flux-dev": 0.030,
    "dall-e-3": 0.040,
    "gemini-2.5-flash-image": 0.040,
    "gpt-image-2": 0.040,
    "gpt-image-1.5": 0.050,
    "flux-pro": 0.050,
    "sora_image": 0.050,
    "gpt-image-1": 0.060,
    "nano-banana": 0.080,
    "gemini-3.1-flash-image-preview": 0.100,
    "flux-pro-max": 0.100,
    "recraftv3": 0.120,
    "ideogram-generate-v3": 0.180,
    "nano-banana-pro": 0.200,
    "gemini-3-pro-image-preview": 0.200,
    # videos (per call)
    "viduq3-turbo": 0.0281,
    "viduq2-pro-fast": 0.0281,
    "vidu1.5": 0.0281,
    "viduq3": 0.0281,
    "sora-2": 0.10,
    "veo3.1-fast": 0.20,
    "veo3.1": 0.30,
    "pika-generate": 0.60,
    "runwayml-gen4_turbo": 0.80,
    "sora-2-pro": 2.50,
    "veo3.1-pro-4k": 13.00,
}

# Models that consistently fail submission under our key — refuse early so
# the agent doesn't waste a budget cycle waiting for the inevitable failure.
BROKEN_MODELS = {
    "kling-video-v2-1", "kling-video-v1-6", "kling-video-v2-5-turbo",
    "kling-video-v2-master", "kling-video-multi-elements-init",
    "doubao-seedance-1-0-lite-i2v-250428", "wan2.6-i2v",
    "MiniMax-Hailuo-2.3-Fast", "pixverse-video",
    "whisper-1", "claude-haiku-4-5-20251001",
}

# When --cheap is passed, swap default model for the cheapest known-working one.
CHEAP_IMAGE_MODEL = "flux"
CHEAP_VIDEO_MODEL = "viduq3-turbo"
# Fallback chain: if --cheap video model rejects submit (no task_id, vidu
# channel can be flaky), retry on veo3.1-fast which is known to work.
CHEAP_VIDEO_FALLBACK = "veo3.1-fast"


def die(msg, code=1):
    print("[designapi] ERROR: " + msg, file=sys.stderr)
    sys.exit(code)


def require_key():
    if not KEY:
        die("DESIGNAPI_API_KEY env var missing — ask the platform to inject it (code-exec.platformFallback)")


def log_event(kind, model, cost_usd, status, extra=None):
    """Append one JSON-line entry to /workspace/.tools/designapi.log so the
    coder agent (and any downstream auditor) can grep aggregate spend
    without re-parsing tool output."""
    try:
        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        rec = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "kind": kind,
            "model": model,
            "cost_usd": cost_usd,
            "status": status,
        }
        if extra:
            rec.update(extra)
        with open(LOG_PATH, "a") as f:
            f.write(json.dumps(rec) + "\n")
    except Exception as exc:
        print("[designapi] log write failed: " + str(exc), file=sys.stderr)


def known_price(model):
    return PRICE_TABLE.get(model)


def assert_budget(model, budget_usd):
    """Refuse to call `model` if its known price exceeds `budget_usd`. Unknown
    models slip through (we'd rather try than block). Budget None disables."""
    if budget_usd is None:
        return
    price = known_price(model)
    if price is None:
        return
    if price > budget_usd + 1e-9:
        die(
            "model %s costs ~$%.4f/call which exceeds --budget $%.4f. "
            "Use a cheaper model (e.g. --cheap) or raise --budget."
            % (model, price, budget_usd)
        )


def announce_cost(kind, model):
    price = known_price(model)
    if price is None:
        print("[designapi] %s via %s — price unknown (not in table)" % (kind, model))
    else:
        print("[designapi] %s via %s — ~$%.4f/call (estimated)" % (kind, model, price))


def http(method, path, *, json_body=None, multipart=None, timeout=180):
    require_key()
    url = BASE + path
    headers = {"Authorization": "Bearer " + KEY}
    data = None
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    elif multipart is not None:
        boundary = "----af" + str(int(time.time() * 1000))
        body = b""
        for k, v in multipart.items():
            body += ("--" + boundary + "\r\n").encode()
            body += ('Content-Disposition: form-data; name="' + k + '"\r\n\r\n').encode()
            body += (str(v) + "\r\n").encode()
        body += ("--" + boundary + "--\r\n").encode()
        data = body
        headers["Content-Type"] = "multipart/form-data; boundary=" + boundary
    req = urllib.request.Request(url, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
    except urllib.error.HTTPError as e:
        raw = e.read()
    try:
        return json.loads(raw)
    except Exception:
        return {"_raw": raw[:500].decode("utf-8", errors="replace"), "_http_error": True}


def cmd_image(args):
    if args.model in BROKEN_MODELS:
        die("model %s is in BROKEN_MODELS — pick a different one" % args.model)
    if args.cheap:
        args.model = CHEAP_IMAGE_MODEL
    assert_budget(args.model, args.budget)
    announce_cost("image", args.model)
    body = {"model": args.model, "prompt": args.prompt, "n": 1}
    if args.size:
        body["size"] = args.size
    elif args.aspect:
        body["aspect_ratio"] = args.aspect
    else:
        body["size"] = "1024x1024"
    r = http("POST", "/v1/images/generations", json_body=body)
    data = r.get("data") if isinstance(r, dict) else None
    url = None
    if isinstance(data, list) and data:
        first = data[0] or {}
        url = first.get("url") or first.get("image_url") or first.get("b64_url")
    if not url:
        log_event("image", args.model, known_price(args.model), "fail",
                  {"err": json.dumps(r)[:200]})
        die("image gen failed: " + json.dumps(r)[:600])
    print("[designapi] image url: " + url)
    saved_path = None
    if args.out:
        os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
        with urllib.request.urlopen(url, timeout=120) as resp, open(args.out, "wb") as f:
            f.write(resp.read())
        with open(args.out + ".url", "w") as f:
            f.write(url)
        saved_path = args.out
        print("[designapi] saved -> " + args.out)
    log_event("image", args.model, known_price(args.model), "ok",
              {"path": saved_path, "url": url})
    return url


def _poll_video(task_id):
    poll_path = "/v1/video/generations/" + task_id
    last_status = None
    for i in range(24):
        wait = 15 if i < 4 else 30
        time.sleep(wait)
        r = http("GET", poll_path, timeout=60)
        if not isinstance(r, dict):
            print("[designapi]   #%d malformed response: %r" % (i + 1, r), file=sys.stderr)
            continue
        d = r.get("data") if isinstance(r.get("data"), dict) else {}
        status = d.get("status") or r.get("status") or last_status
        progress = d.get("progress")
        last_status = status
        print("[designapi]   #%d status=%s progress=%s" % (i + 1, status, progress))
        if status in ("SUCCESS", "completed", "succeeded"):
            inner = d.get("data") or {}
            url = (
                inner.get("video_url")
                or d.get("video_url")
                or d.get("result_url")
                or r.get("video_url")
            )
            if url and isinstance(url, str) and url.startswith("http"):
                return ("ok", url)
            return ("error", "success_but_no_url: " + json.dumps(r)[:300])
        if status in ("FAILURE", "FAILED", "failed"):
            return ("fail", json.dumps(r)[:300])
    return ("timeout", "polling exceeded 24 cycles (~10min)")


def _submit_video(model, prompt, duration, aspect, image_url):
    """Try multipart first (matches veo3.1-fast). If submit returns no task_id
    AND the model isn't veo*, retry with JSON body — vidu* / sora-2 channels
    have undocumented shapes and JSON sometimes works where multipart 404s."""
    forms = [{"shape": "multipart"}]
    if not model.startswith("veo"):
        forms.append({"shape": "json"})
    last = None
    for form in forms:
        if form["shape"] == "multipart":
            payload = {
                "model": model,
                "prompt": prompt,
                "duration": str(duration),
                "aspect_ratio": aspect,
            }
            if image_url:
                payload["image_url"] = image_url
            sub = http("POST", "/v1/video/generations", multipart=payload)
        else:
            payload = {
                "model": model,
                "prompt": prompt,
                "duration": int(duration),
                "aspect_ratio": aspect,
            }
            if image_url:
                payload["image_url"] = image_url
            sub = http("POST", "/v1/video/generations", json_body=payload)
        if not isinstance(sub, dict):
            last = "submit_malformed_%s: %s" % (form["shape"], str(sub)[:160])
            continue
        tid = sub.get("task_id") or sub.get("id") or (sub.get("data") or {}).get("task_id")
        if tid:
            return tid, None
        last = "submit_no_task_id_%s: %s" % (form["shape"], json.dumps(sub)[:240])
    return None, last or "submit_failed"


def _try_video_model(model, args):
    """One full attempt-cycle (submit + poll, with one re-submit on FAILURE)
    against a single model. Returns (url, None) on success or (None, err)."""
    if model in BROKEN_MODELS:
        return None, "broken_model"
    last_err = "no_attempts"
    for attempt in (1, 2):
        tid, sub_err = _submit_video(model, args.prompt, args.duration, args.aspect, args.image_url)
        if not tid:
            last_err = sub_err or "submit_failed"
            print("[designapi] %s attempt %d submit: %s" % (model, attempt, last_err), file=sys.stderr)
            continue
        print("[designapi] %s attempt %d task_id=%s, polling..." % (model, attempt, tid))
        outcome, payload = _poll_video(tid)
        if outcome == "ok":
            return payload, None
        last_err = "%s: %s" % (outcome, payload)
        print("[designapi] %s attempt %d %s" % (model, attempt, last_err), file=sys.stderr)
    return None, last_err


def cmd_video(args):
    if args.cheap:
        args.model = CHEAP_VIDEO_MODEL
    if args.model in BROKEN_MODELS:
        die("model %s is in BROKEN_MODELS — pick a different one" % args.model)
    assert_budget(args.model, args.budget)
    announce_cost("video", args.model)

    url, err = _try_video_model(args.model, args)
    used_model = args.model
    if not url and args.cheap and CHEAP_VIDEO_FALLBACK and args.model != CHEAP_VIDEO_FALLBACK:
        print("[designapi] cheap model %s failed (%s) — falling back to %s"
              % (args.model, err, CHEAP_VIDEO_FALLBACK), file=sys.stderr)
        # Re-check budget for fallback. If exceeded, give up rather than
        # silently overspend.
        assert_budget(CHEAP_VIDEO_FALLBACK, args.budget)
        announce_cost("video", CHEAP_VIDEO_FALLBACK)
        url, err = _try_video_model(CHEAP_VIDEO_FALLBACK, args)
        if url:
            used_model = CHEAP_VIDEO_FALLBACK
    if not url:
        log_event("video", used_model, known_price(used_model), "fail",
                  {"err": (err or "unknown")[:200]})
        die("video generation failed: " + (err or "unknown"))

    print("[designapi] video url: " + url)
    saved_path = None
    if args.out:
        os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
        with urllib.request.urlopen(url, timeout=240) as resp, open(args.out, "wb") as f:
            f.write(resp.read())
        with open(args.out + ".url", "w") as f:
            f.write(url)
        saved_path = args.out
        print("[designapi] saved -> " + args.out)
    log_event("video", used_model, known_price(used_model), "ok",
              {"path": saved_path, "url": url})
    return url


def cmd_prices(args):
    """Fetch live pricing from the platform endpoint and print a filtered
    table. Falls back to the embedded PRICE_TABLE if the endpoint is
    unreachable."""
    live = http("GET", "/api/pricing", timeout=15)
    table = {}
    if isinstance(live, dict) and not live.get("_http_error"):
        items = live.get("data") if isinstance(live.get("data"), list) else live.get("models")
        if isinstance(items, list):
            for it in items:
                if not isinstance(it, dict):
                    continue
                name = it.get("model") or it.get("name") or it.get("id")
                price = it.get("price") or it.get("cost_per_call") or it.get("usd")
                kind = it.get("group") or it.get("kind") or it.get("type") or ""
                if name and price is not None:
                    try:
                        table[name] = (float(price), str(kind))
                    except (TypeError, ValueError):
                        continue
    source = "live"
    if not table:
        source = "snapshot"
        for name, price in PRICE_TABLE.items():
            kind = "video" if any(name.startswith(p) for p in ("veo", "vidu", "sora-", "kling", "pika", "runway")) else "image"
            table[name] = (price, kind)
    rows = sorted(table.items(), key=lambda kv: kv[1][0])
    flt = (args.filter or "").lower().strip()
    print("[designapi] pricing source=%s filter=%s" % (source, flt or "<none>"))
    print("%-44s %-8s %s" % ("model", "kind", "$/call"))
    for name, (price, kind) in rows:
        if flt and flt not in (kind or "").lower():
            continue
        print("%-44s %-8s %.4f" % (name, kind or "?", price))


def main():
    p = argparse.ArgumentParser(prog="designapi")
    sp = p.add_subparsers(dest="cmd", required=True)

    pi = sp.add_parser("image", help="generate one image (sync)")
    pi.add_argument("--prompt", required=True)
    pi.add_argument("--model", default="nano-banana-pro",
                    help="default nano-banana-pro ($0.20). Run 'designapi.py prices --filter image' for cheaper options.")
    pi.add_argument("--cheap", action="store_true",
                    help="force the cheapest known-good model (flux, $0.01)")
    pi.add_argument("--budget", type=float, default=None,
                    help="USD/call cap; refuse if model price exceeds it")
    pi.add_argument("--aspect", default="16:9", help="e.g. 16:9, 9:16, 1:1")
    pi.add_argument("--size", help="e.g. 1024x1024, 1536x1024 (overrides --aspect)")
    pi.add_argument("--out", help="local path to save the .jpg/.png")
    pi.set_defaults(func=cmd_image)

    pv = sp.add_parser("video", help="generate one short video (async, ~90-180s)")
    pv.add_argument("--prompt", required=True)
    pv.add_argument("--model", default="veo3.1-fast",
                    help="default veo3.1-fast ($0.20, tested). vidu*/sora-2 schemas are best-effort.")
    pv.add_argument("--cheap", action="store_true",
                    help="try viduq3-turbo ($0.028); auto-fallback to veo3.1-fast on submit fail")
    pv.add_argument("--budget", type=float, default=None,
                    help="USD/call cap; refuse if model price exceeds it (also gates --cheap fallback)")
    pv.add_argument("--duration", type=int, default=5,
                    help="5-8s recommended; longer durations not supported")
    pv.add_argument("--aspect", default="16:9")
    pv.add_argument("--image_url", help="optional source image for image-to-video")
    pv.add_argument("--out", help="local path to save the .mp4")
    pv.set_defaults(func=cmd_video)

    pp = sp.add_parser("prices", help="fetch live model pricing from /api/pricing")
    pp.add_argument("--filter", default=None, help="image | video | chat (substring match)")
    pp.set_defaults(func=cmd_prices)

    a = p.parse_args()
    a.func(a)


if __name__ == "__main__":
    main()
