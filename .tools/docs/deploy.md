# Deploy через start_service / expose_public — рецепт

## Что делает code-exec.start_service
Стартует процесс В ПОДЕ как durable supervisor-like процесс. Логи живут до перезапуска pod'а. Идемпотентен — повторный вызов с тем же `name` убивает старый и стартует новый.

## Когда использовать start_service
- HTTP server (npx http-server / uvicorn / express)
- Bot polling (aiogram / PTB)
- Background worker (celery / queue consumer)
- WebSocket server

## Когда НЕ использовать (используй обычный exec)
- Build (npm run build, tsc, webpack, vite build) — одноразовая задача.
- Migrate (prisma migrate, alembic upgrade) — одноразовая задача.
- Тесты (npm test, pytest) — одноразовая задача.
- Linter / typecheck.

## Пример вызова
```
code-exec.start_service({
  project: "proj-...",
  name: "http",
  command: "npx -y http-server /workspace/dist -p 8080 -c-1 --cors",
  ports: [8080]
})
```

`ports: [8080]` — нужно для expose_public.

## expose_public
После того как process слушает порт — делает proxy URL вида `https://<project>.proj.agentflow.website` доступным.

```
code-exec.expose_public({ project: "proj-...", port: 8080 })
```

Возвращает `{ url, ok }`. URL это и есть твой preview_url.

## Проверка ДО REPLY (всегда!)
```bash
# 1. Локально внутри pod'а — процесс жив?
ps aux | grep -E "node|python|uvicorn" | head -5
curl -sI http://localhost:8080/

# 2. Через proxy URL — снаружи виден?
curl -sI https://<project>.proj.agentflow.website/
```

Если внутри pod'а 200 а снаружи 502 — `expose_public` ещё не дораспространился, подожди 5-10 сек и retry.

## Финальный REPLY
В REPLY юзеру ОБЯЗАТЕЛЬНО:
1. Конкретный preview_url (полный, с https://).
2. Состояние сервисов (что запущено, какие порты).
3. Acceptance чек: что точно проверил (HTTP 200, /api/health, бот отвечает, etc).

Пример:
```
preview_url: https://proj-abc123.proj.agentflow.website
service: http (port 8080) — running
acceptance: GET / → 200, title="Real Title", <img> present, /assets/index-*.css → 200 (8KB)
```

## Common pitfalls
- **запустил через `exec` с `&`**: процесс умрёт когда exec вернёт. Используй start_service.
- **expose_public до start_service**: 404 на proxy URL пока process не слушает. Сначала start_service, потом expose_public.
- **0.0.0.0 vs localhost**: процесс ДОЛЖЕН слушать 0.0.0.0:<port>, иначе proxy не доходит.
- **port mismatch**: ports в start_service ОБЯЗАН совпадать с реальным listen-портом, иначе expose_public не найдёт.
