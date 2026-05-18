# WebSocket realtime chat — рецепт

## FastAPI server
```bash
cd /workspace && python3 -m pip install --quiet fastapi "uvicorn[standard]"
```

```python
# main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse

app = FastAPI()
clients: set[WebSocket] = set()

@app.websocket("/ws")
async def ws_endpoint(socket: WebSocket):
    await socket.accept()
    clients.add(socket)
    try:
        while True:
            text = await socket.receive_text()
            for c in list(clients):
                if c is not socket:
                    try:
                        await c.send_text(text)
                    except Exception:
                        clients.discard(c)
    except WebSocketDisconnect:
        clients.discard(socket)
```

## Frontend — vanilla JS
```html
<script>
const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${proto}//${location.host}/ws`);
ws.onmessage = (e) => console.log("RECV:", e.data);
ws.onopen = () => ws.send("hello");
</script>
```

КРИТИЧНО: `wss://` за HTTPS proxy, `ws://` за HTTP. `location.protocol` подсказывает.

## Запуск
```json
{ "name": "ws", "command": "uvicorn main:app --host 0.0.0.0 --port 8080", "ports": [8080] }
```

## Acceptance
1. HTML на `/` отдаёт 200.
2. WS handshake `/ws` отдаёт 101 Switching Protocols.
3. 2 клиента одновременно: первый отправил → второй получил.

## Common pitfalls
- **uvicorn без `[standard]` extras**: WS endpoint падает на 500. Ставь `uvicorn[standard]`.
- **broadcast vs echo**: echo (отправь обратно тому же socket) для smoke easier; broadcast (всем кроме себя) — реальный chat.
- **memory leak from disconnected clients**: оборачивай `send_text` в try/except и удаляй мёртвых клиентов из set.
