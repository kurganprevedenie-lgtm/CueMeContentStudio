# CueMe Content Studio

Веб-приложение для генерации вирусных видео в формате «фейковой переписки» (fake text story).
Отдельный продукт-компаньон для [CueMe](https://t.me/CueMeChatBot) — тот же паттерн распространения через TikTok/Reels, но фокус на автоматизации создания контента, а не на самом мессенджере.

## Что это делает

1. Пользователь вводит диалог (кто пишет, что пишет, с какой стороны экрана)
2. Выбирает визуальную тему (iMessage light/dark, Instagram DM) и аватарки
3. Выбирает голоса для озвучки каждого участника (ElevenLabs)
4. Приложение рендерит видео: анимированное появление сообщений, синхронизированное с озвучкой
5. Готовый .mp4 скачивается и уходит в TikTok/Reels/Shorts — либо публикуется напрямую в TikTok (черновик), YouTube (Shorts) или Instagram (Reels)

## Стек

- **Next.js 14+** (App Router) + TypeScript
- **Tailwind CSS** + Shadcn UI
- **Remotion** — рендер видео из React-компонентов
- **ElevenLabs API** — text-to-speech
- **Zustand** — состояние диалога/темы
- **pnpm** workspaces (монорепо)

## Структура проекта

```
cueme-content-studio/
├── apps/
│   └── web/              # Next.js приложение (UI, формы, превью)
├── packages/
│   ├── remotion/          # Composition'ы для рендера видео
│   └── shared/            # Общие типы, zustand store
├── .env.example
├── ARCHITECTURE.md         # как всё устроено, на каком этапе проект
├── CONTRIBUTING.md         # как вливаться в разработку
└── CLAUDE.md               # контекст для Claude Code
```

## Быстрый старт

```bash
git clone <repo-url>
cd cueme-content-studio
pnpm install
cp .env.example .env       # заполнить ELEVENLABS_API_KEY
pnpm dev
```

Приложение поднимется на `localhost:3000`.

## Статус проекта

Смотри [ARCHITECTURE.md](./ARCHITECTURE.md) — там разбивка по этапам и текущий прогресс.

## Как помочь / вливание в разработку

Смотри [CONTRIBUTING.md](./CONTRIBUTING.md).
