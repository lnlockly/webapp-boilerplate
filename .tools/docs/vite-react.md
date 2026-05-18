# Vite + React SPA — рецепт

## Создание проекта
```bash
cd /workspace && (test -f package.json || npm create vite@latest . -- --template react-ts -y)
cd /workspace && npm install
```

`timeout_sec >= 120` для install — npm может ставить долго на холодном кеше.

## Сборка
```bash
cd /workspace && npm run build
ls -la /workspace/dist/
ls -la /workspace/dist/assets/
```

После build видны `index.html`, `assets/index-<hash>.js`, `assets/index-<hash>.css`.

## Запуск http-server для превью (КРИТИЧНО — из dist!)
```bash
cd /workspace && (pkill -f "http-server\|http.server" 2>/dev/null || true)
cd /workspace && nohup npx -y http-server dist -p 8080 -c-1 --cors >/tmp/http.log 2>&1 &
sleep 2
curl -sI http://localhost:8080/
curl -sI http://localhost:8080/assets/$(ls dist/assets/ | head -1)
```

Лучше — через `start_service`:
```json
{ "name": "http", "command": "npx -y http-server /workspace/dist -p 8080 -c-1 --cors", "ports": [8080] }
```

## Acceptance gate landing — что проверяет платформа
- HTTP 200 на `/`
- title в `<head>` НЕ "Vite + React" / "React App" / "Document"
- хотя бы 1 `<img>` в body
- `<link rel="stylesheet">` отдаёт 200 И размер CSS >= 1KB
- `<script src=...>` отдаёт 200

## Common pitfalls
- **серверим из /workspace вместо /workspace/dist** → `/assets/*` не находятся → 404 на CSS → acceptance fail. Всегда из dist.
- **dev mode** `npm run dev` — НЕ для production preview. Используй build → http-server.
- **base path**: если проект монтируется не на корень, поставь `base: "/<subpath>/"` в vite.config.ts.
- **title не меняется**: edit `index.html` (в корне проекта, не в dist) ДО build.
- **Tailwind 4 setup**: для Vite 7 → `@tailwindcss/vite` plugin (новый API). См. agentflow-style.md.

## Минимальный App.tsx с реальным контентом
```tsx
export default function App() {
  return (
    <main style={{ fontFamily: "system-ui", background: "#0b0d10", color: "#e7eaee", minHeight: "100vh" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px" }}>
        <h1>{/* REAL_TITLE из brief */}</h1>
        <img src="/avatar.jpg" alt="avatar" />
        <p>{/* lead-параграф из brief */}</p>
      </div>
    </main>
  );
}
```
