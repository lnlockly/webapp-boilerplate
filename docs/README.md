# Project workspace

Этот pod собирается фабрикой AgentFlow. Структура:

- frontend/ — UI код (React, Vite, Next, Astro)
- backend/  — сервер (FastAPI, NestJS, aiogram, worker, cron)
- docs/     — README, ADR, API spec, OpenAPI

Не клади исходники в корень /workspace — caddy preview и runtime-supervisor ожидают каноничный layout.
