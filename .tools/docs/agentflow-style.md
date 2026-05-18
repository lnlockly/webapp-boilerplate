# AgentFlow design tokens — рецепт

Используй ЭТИ токены когда landing/SPA должен соответствовать стилю платформы (default для проектов созданных через AgentFlow UI).

## Цвета
```css
:root {
  --af-bg: #0b0d10;
  --af-surface: #141820;
  --af-surface-2: #1c2230;
  --af-text: #e7eaee;
  --af-text-muted: #8a93a4;
  --af-accent: #6a8cff;
  --af-accent-2: #b48cff;
  --af-success: #2ecc71;
  --af-danger: #ff6b6b;
  --af-radius: 12px;
}
body { background: var(--af-bg); color: var(--af-text); font-family: 'Inter', system-ui, sans-serif; }
```

## Типографика
- **Headings**: Inter / SF Pro Display, weight 600-700.
- **Body**: Inter / SF Pro Text, weight 400-500, line-height 1.6.
- **Mono** (для code): JetBrains Mono / SF Mono.

## Компоненты-ориентиры (vanilla CSS)
```css
.af-card {
  background: var(--af-surface);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--af-radius);
  padding: 24px;
}
.af-button {
  background: linear-gradient(135deg, var(--af-accent), var(--af-accent-2));
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  cursor: pointer;
}
.af-input {
  background: var(--af-surface-2);
  border: 1px solid rgba(255,255,255,0.08);
  color: var(--af-text);
  padding: 10px 14px;
  border-radius: 8px;
}
```

## Tailwind 4 (Vite plugin)
Если используешь Tailwind, поставь:
```bash
cd /workspace && npm install -D tailwindcss @tailwindcss/vite
```

Подключи в vite.config.ts:
```ts
import tailwindcss from "@tailwindcss/vite";
export default { plugins: [tailwindcss()] };
```

В CSS файле:
```css
@import "tailwindcss";
@theme {
  --color-af-bg: #0b0d10;
  --color-af-accent: #6a8cff;
}
```

## Hero-блок template
```html
<section style="padding:96px 24px;text-align:center;background:linear-gradient(180deg,#0b0d10 0%,#141820 100%);">
  <h1 style="font-size:56px;margin:0 0 16px 0;background:linear-gradient(135deg,#6a8cff,#b48cff);-webkit-background-clip:text;color:transparent;">{{HEADLINE}}</h1>
  <p style="font-size:20px;color:#8a93a4;max-width:640px;margin:0 auto 32px auto;">{{LEAD}}</p>
  <button class="af-button">{{CTA_TEXT}}</button>
</section>
```

## Common pitfalls
- **white background**: AgentFlow стиль — DARK. Не делай белый landing.
- **Comic Sans / Times**: только Inter / SF / system-ui.
- **flat без accent**: используй gradient на CTA (см. выше).
