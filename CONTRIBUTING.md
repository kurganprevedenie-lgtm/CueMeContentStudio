# Contributing

## Перед началом

1. Прочитай [README.md](./README.md) — что это и зачем
2. Прочитай [ARCHITECTURE.md](./ARCHITECTURE.md) — на каком этапе проект сейчас
3. Возьми `.env.example`, попроси актуальный `ELEVENLABS_API_KEY` у владельца репозитория — не коммить реальные ключи никогда

## Зоны ответственности

Проект специально разбит так, чтобы можно было работать параллельно, не наступая друг другу на ноги:

- **Фронт/UI** (этапы 1-2): формы, ChatBubble/ChatContainer, темы, аватарки — папка `apps/web`
- **Видео/аудио** (этапы 3-5): ElevenLabs интеграция, Remotion composition, серверный рендер — папки `apps/web/actions` и `packages/remotion`

Если не уверен, в какую зону попадает задача — спроси в общем чате перед тем как начинать.

## Ветки и коммиты

- `main` защищена, напрямую не пушим
- Ветки: `feature/short-description`, `fix/short-description`
- Коммиты — по смыслу, не «wip» или «fix»: `feat: add avatar upload`, `fix: sync audio duration with bubble timing`

## Pull Request

1. Одна ветка = одна логическая задача (не смешивай UI-правки и Remotion-правки в одном PR)
2. В описании PR — что сделано и как проверить локально
3. Если меняешь props `Message` или Remotion Composition — обязательно отметь в PR, что затрагивает чужой код (см. «Не трогать без согласования» в ARCHITECTURE.md)

## Локальный запуск

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Если что-то не запускается — сначала проверь `.env`, потом версию Node (нужен 18+).
