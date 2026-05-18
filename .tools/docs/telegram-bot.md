# Telegram bot (aiogram 3.x) — рецепт

## Платформа уже сделала за тебя
Для kind=tg_bot платформа автоматически:
- создала бота через master @BotFather
- положила токен в `/workspace/bot_token.txt` И в env `BOT_TOKEN`
- скаффолдила `bot.py` (echo) + `bot_handler.py` (sync reply для preview)

**НЕ создавай нового бота через BotFather внутри pod'а** — токен уже есть.

## Проверь токен ДО написания кода
```bash
echo "$BOT_TOKEN" | head -c 20
cat /workspace/bot_token.txt 2>/dev/null
curl -s "https://api.telegram.org/bot$BOT_TOKEN/getMe" | python3 -m json.tool
# ok должен быть true и result.username непустой
```

## Установка aiogram
```bash
cd /workspace && python3 -m pip install --quiet "aiogram>=3.0,<4" python-dotenv
```

## Минимальный bot.py (aiogram 3.x)
```python
import asyncio, os, random
from aiogram import Bot, Dispatcher
from aiogram.types import Message
from aiogram.filters import Command

BOT_TOKEN = os.environ.get("BOT_TOKEN") or open("/workspace/bot_token.txt").read().strip()
QUOTES = [
    "Если ты сомневаешься — действуй.",
    "Простота — высшая форма утончённости.",
    "Делай или не делай. Не пробуй.",
    "Любая сложная проблема имеет простое неправильное решение.",
    "Не ошибается тот, кто ничего не делает.",
]

bot = Bot(BOT_TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def cmd_start(m: Message):
    await m.answer("Hello from AgentFlow")

@dp.message(Command("quote"))
async def cmd_quote(m: Message):
    await m.answer(random.choice(QUOTES))

if __name__ == "__main__":
    asyncio.run(dp.start_polling(bot))
```

## Запуск через start_service (durable!)
```json
{
  "name": "bot",
  "command": "python3 -u /workspace/bot.py",
  "ports": []
}
```

`-u` — unbuffered output, чтобы логи писались сразу.

## Smoke тест от bot-tester (через TG-оператора)
После старта bot подожди 3-5 сек и попроси bot-tester вызвать smoke_test_bot:
```
delegate_to_agent_sync(agent_slug="<tg-op>", task="telegram.smoke_test_bot(bot_username='@<botUsername>', max_depth=2, max_steps=10)")
```
Ожидаемый transcript: `/start → "Hello from AgentFlow"`, `/quote → "<одна из 5 цитат>"`.

## Common pitfalls
- **aiogram 2.x vs 3.x**: API разный. В этом рецепте — 3.x. `pip install` без version pin может установить 2.x старый.
- **BOT_TOKEN placeholder**: НЕ оставляй `"YOUR_TOKEN"` в коде. `getMe` сразу покажет 401.
- **Polling не запустился**: процесс должен быть live. Если запустил через `exec` с `&` — он умрёт когда exec вернёт. Используй `start_service`.
- **Multiple Dispatchers**: НЕ создавай несколько `Dispatcher` экземпляров — конфликт polling с Telegram API (только один long-poll одновременно).
- **`webhook` vs `polling`**: для self-hosted в pod'е используй polling (нет публичного URL под webhook). Если потребуется webhook — нужен ngrok/expose_public, см. deploy.md.

## Acceptance
1. getMe → ok:true, username непустой.
2. send /start → reply содержит ожидаемое приветствие из brief.
3. Все команды из brief реально работают (не одна заглушка на все).
