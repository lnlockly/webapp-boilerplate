# Matrix Synapse homeserver — рецепт

## Когда использовать
Brief требует Matrix protocol / chat federation / self-hosted messenger.

## Установка
```bash
cd /workspace && python3 -m pip install --quiet "matrix-synapse[postgres,redis]"
mkdir -p /workspace/synapse && cd /workspace/synapse
python3 -m synapse.app.homeserver \
  --server-name localhost \
  --config-path homeserver.yaml \
  --generate-config \
  --report-stats=no
```

## Конфиг (минимум для smoke)
Generate-config создаёт `homeserver.yaml` с SQLite + listener на 8008. Этого достаточно для проверки. Файл `<server-name>.signing.key` тоже создаётся автоматически.

## Запуск
ПРОЦЕССЫ ДОЛЖНЫ ЖИТЬ — используй `code-exec.start_service`:
```json
{
  "name": "synapse",
  "command": "python3 -m synapse.app.homeserver --config-path /workspace/synapse/homeserver.yaml",
  "ports": [8008]
}
```

## Проверка работы
```bash
curl -s http://localhost:8008/_matrix/client/versions | python3 -m json.tool
# должен вернуть { "versions": ["r0.0.1", ...] }
```

## Создать тестового пользователя
```bash
register_new_matrix_user -c /workspace/synapse/homeserver.yaml http://localhost:8008
# интерактивно: username, password, admin? (yes/no)

# или non-interactive через registration_shared_secret из homeserver.yaml:
register_new_matrix_user \
  -u testuser -p testpass -a -k <secret_from_yaml> \
  http://localhost:8008
```

## Common pitfalls
- **8008 vs 8448**: 8008 = client API, 8448 = federation TLS. Для smoke хватит 8008.
- **server_name=localhost**: для production нужен реальный домен и DNS .well-known. Для smoke — localhost ОК.
- **Postgres вместо SQLite**: при > 1000 users; для smoke не нужно.
- **`registration_shared_secret` ОТСУТСТВУЕТ**: добавь руками в homeserver.yaml перед запуском.
- **CORS**: для browser клиентов добавь `allow_origins` в listener http_options.
- **federation отключи если не нужно**: `federation_domain_whitelist: []` чтобы Synapse не пытался федерироваться.

## Верификация для acceptance
1. `/_matrix/client/versions` → 200 + JSON.
2. Создан хотя бы 1 user.
3. `POST /_matrix/client/v3/login` с этим user → access_token.
