# Архитектура

## Поток данных

```
Форма ввода диалога
        ↓
  Zustand store (messages[], theme, avatars)
        ↓
  ┌─────────────────┬─────────────────┐
  │                                   │
Live-превью в браузере          Server action → ElevenLabs API
(ChatContainer + framer-motion)     │
                                audioUrl + duration → messages[]
        │                           │
        └──────────────┬────────────┘
                       ↓
          Remotion Composition
          (messages + theme + audio timing)
                       ↓
          Remotion Player (превью видео в браузере)
                       ↓
          Server-side render (@remotion/renderer)
                       ↓
                 .mp4 → скачивание
```

## Этапы разработки

Проект разбит на этапы намеренно — каждый этап самодостаточен, тестируется отдельно и не требует держать в контексте весь проект сразу (важно и для людей, и для работы с Claude Code).

### Этап 1 — Скелет + превью чата ✅
- Next.js + Tailwind + Shadcn базовый проект
- Zustand store: `{ id, sender, text, side: 'left' | 'right', avatarUrl }`
- `ChatBubble.tsx` — пузырь сообщения, стили через props
- `ChatContainer.tsx` — список сообщений, анимация появления (framer-motion)
- Форма добавления сообщения
- **Без Remotion, без ElevenLabs, без бэкенда**

### Этап 2 — Темизация и аватарки ✅
- Объект тем (цвета/шрифты/border-radius): iMessage light/dark, Instagram DM
- Селектор темы в UI
- Загрузка аватарок (input file → base64, без бэкенда)

### Этап 3 — ElevenLabs интеграция ✅
- Server action `generateVoice(text, voiceId)`
- Список голосов через `GET /v1/voices`
- Селектор голоса на участника чата
- Хранение сгенерированного аудио + URL

### Этап 4 — Remotion composition ✅
- Composition принимает `messages[]` (с `audioUrl` и timing) и `theme`
- `useCurrentFrame` + `interpolate` — появление сообщения синхронизировано с длительностью его аудио (через `getAudioDurationInSeconds` из `@remotion/media-utils`, НЕ по количеству символов)
- Remotion Player — превью видео в браузере, без серверного рендера

### Этап 5 — Серверный рендер + экспорт ✅
- API route с `renderMedia` (`@remotion/renderer`)
- Статус-модель `processing / done / error` — рендер асинхронный, не блокирующий запрос
- Скачивание готового .mp4

Отмечай `⬜ → ✅` по мере готовности — так любой новый человек в репозитории (и Claude Code) сразу видит, где мы находимся.

### Этап 6 — Публикация черновика в TikTok ✅
- OAuth 2.0 (`video.upload`), токены — зашифрованным файлом вне репозитория (`apps/web/.data/`, AES-256-GCM, ключ из `TOKEN_ENCRYPTION_KEY`), access_token обновляется через refresh_token заранее (за 5 минут до истечения), не по факту 401
- Content Posting API: `inbox/video/init/` (chunked `FILE_UPLOAD`) → заливка по `upload_url` → поллинг `status/fetch/`
- **Видео всегда уходит во «Входящие» TikTok-аккаунта автора, не публикуется напрямую** — эндпоинт `inbox/video/init/` (scope `video.upload`) специально не требует app review, в отличие от Direct Post (`video/init/`, scope `video.publish`, `privacy_level`) — тот путь пробовали первым, но TikTok не даёт включить `video.publish` без прохождения ревью (демо-видео, рассмотрение). В UI везде формулировки про "черновик", не "опубликовано"
- См. `apps/web/lib/tiktokApi.ts`, `tiktokTokenStore.ts`, `tiktokJobs.ts`

## Технические ограничения, которые стоит держать в голове

- **Серверный рендер видео — тяжёлая операция.** Не заводить на обычных serverless-функциях с коротким таймаутом (Vercel functions таймаутятся). Нужен отдельный воркер или Remotion Lambda.
- **Синхронизация звука с текстом** всегда идёт от реальной длительности аудиофайла, не от эвристики по длине текста.
- **ElevenLabs тарифицируется по символам** — в UI должен быть индикатор примерной стоимости/остатка лимита перед генерацией, иначе тесты съедят кредиты незаметно.
- **TikTok Content Posting API** пока используется только через inbox-эндпоинт (`video.upload`, черновик во «Входящих») — приложение не проходило app review. Прежде чем переключаться на Direct Post/`video.publish` или добавлять публичную публикацию, нужно отдельное согласование (и пройденный review на стороне TikTok, с демо-видео).

## Не трогать без согласования

- Props Remotion Composition (`packages/remotion`) — на них завязан рендер, изменение ломает совместимость с уже отрендеренными проектами
- Схему `Message` в `packages/shared` — используется и в превью, и в composition
