# AgentFlow Coder Knowledge Library

Этот каталог — рецепты под типовые стеки. Перед задачей с незнакомым/сложным стеком открой соответствующий файл.

| Topic | Когда читать | Файл |
|-------|------|------|
| Matrix Synapse | brief требует Matrix homeserver / chat federation | synapse.md |
| Telegram bot (aiogram 3.x) | kind=tg_bot | telegram-bot.md |
| Vite + React SPA | kind=spa, любой современный JS frontend | vite-react.md |
| FastAPI backend | kind=api, REST или WebSocket | fastapi.md |
| PostgreSQL local | внутри pod'а нужна DB | database.md |
| WebSocket realtime | live chat / typing indicators / multiplayer | ws-chat.md |
| AgentFlow design tokens | landing/SPA должен соответствовать стилю платформы | agentflow-style.md |
| Deploy через start_service / expose_public | финальный шаг любого проекта | deploy.md |

## Общие правила
1. ВСЁ внутри `/workspace` (это твой pod). Никаких "купите VPS / задеплойте на Vercel".
2. Каждый `exec` — отдельная shell-сессия (cwd сбрасывается). Используй `cd /workspace && ...` в одной команде.
3. Для процессов (bot polling, uvicorn, http-server) — `code-exec.start_service` (durable), не `exec` с `&` (умрёт).
4. Перед финальным REPLY ВСЕГДА `curl -sI http://localhost:<port>/` — убедись что 200.
5. Эти доки кеши — если найдёшь баг, он скорее всего у тебя в коде, не в рецепте.
