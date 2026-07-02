# Контекст для Claude Code

## Проект

CueMe Content Studio — веб-приложение для генерации видео «фейковой переписки» (fake text story) с озвучкой. Компаньон-продукт к Telegram-боту CueMe.

## Стек

Next.js 14+ (App Router, TypeScript), Tailwind CSS, Shadcn UI, Remotion (видео-рендер), ElevenLabs API (text-to-speech), Zustand, pnpm workspaces.

## Структура

```
apps/web/          — Next.js приложение
packages/remotion/ — Remotion composition'ы
packages/shared/   — общие типы и zustand store
```

## Текущий этап

Смотри ARCHITECTURE.md в корне репозитория — там актуальный статус по этапам 1-5 (⬜/✅). Работай строго в рамках текущего этапа, не забегай вперёд на следующие, даже если кажется что это "заодно" быстрее сделать.

## Правила работы

- Не трогай props Remotion Composition и схему `Message` в `packages/shared` без явного запроса — на них завязан весь пайплайн рендера
- Синхронизация аудио с текстом — всегда через реальную длительность файла (`getAudioDurationInSeconds` из `@remotion/media-utils`), никогда не через оценку по длине текста
- ElevenLabs API ключ — только из `process.env.ELEVENLABS_API_KEY`, никогда не хардкодить и не выводить в логи
- Серверный рендер видео — асинхронная операция со статусом `processing/done/error`, не блокирующий запрос

## Стиль кода

- TypeScript strict
- Компоненты — функциональные, без классов
- Стили — только Tailwind + Shadcn, без inline-styles кроме случаев, где нужны динамические значения из props темы
