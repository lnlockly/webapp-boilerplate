# FastAPI backend — рецепт

## Установка
```bash
cd /workspace && python3 -m pip install --quiet fastapi "uvicorn[standard]" pydantic
```

`uvicorn[standard]` важно: подтягивает websockets + httptools + watchgod (нужно для prod-grade).

## main.py — минимальный API с health + бизнес endpoint
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="My API")

class Item(BaseModel):
    name: str
    qty: int

DB: list[Item] = []

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/items")
def list_items():
    return {"items": [i.model_dump() for i in DB]}

@app.post("/items")
def create(item: Item):
    DB.append(item)
    return {"ok": True, "id": len(DB) - 1}
```

## Запуск через start_service
```json
{
  "name": "api",
  "command": "uvicorn main:app --host 0.0.0.0 --port 8080 --workers 1",
  "ports": [8080]
}
```

КРИТИЧНО: `--host 0.0.0.0` (НЕ `localhost` / `127.0.0.1`) — иначе proxy/expose не дотянется.

## Acceptance
```bash
curl -s http://localhost:8080/health
# {"ok":true}
curl -s http://localhost:8080/openapi.json | python3 -m json.tool | head -50
# полный OpenAPI schema
```

## Async / sync handlers
- `def handler():` — синхронный, выполняется в threadpool.
- `async def handler():` — на event loop. Используй для I/O (DB, HTTP-вызовы).

## CORS (если фронт отдельный SPA)
```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
```

## Common pitfalls
- **`localhost` / `127.0.0.1`**: snubs proxy. Всегда 0.0.0.0.
- **`--reload`**: только для dev. В start_service НЕ используй (рестарт при любом file write засрёт).
- **multiple workers + in-memory DB**: `DB = []` теряется между workers. Для smoke — `--workers 1`.
- **uvicorn без websockets extras**: WebSocket endpoint вернёт 500. Ставь `uvicorn[standard]`.
