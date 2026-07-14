# Как подключить свой YouTube-аккаунт к CueMe Content Studio

## Важно понять сразу

Как и с TikTok (см. `TIKTOK_SETUP.md`), подключение к YouTube хранится на диске того компьютера/сервера, где запущено приложение — по одному Google-аккаунту за раз (`apps/web/lib/youtubeTokenStore.ts`, `apps/web/.data/youtube-tokens.enc`). Поэтому для своего YouTube-аккаунта нужна **своя копия проекта**, а не подключение к чужой уже запущенной.

В остальном процесс проще, чем с TikTok — не нужен ни `dev:https`, ни ngrok, ни добавление себя в тестеры.

## Шаг 0 — Поднять проект у себя

```bash
git clone https://github.com/kurganprevedenie-lgtm/CueMeContentStudio.git
cd CueMeContentStudio
pnpm install
cp .env.example .env
```

Понадобится Node.js 18+ и pnpm. Если уже поднимал проект ради TikTok — этот шаг пропустить.

## Шаг 1 — Создать проект в Google Cloud Console

1. Зайти на [console.cloud.google.com](https://console.cloud.google.com/) под тем Google-аккаунтом, куда будешь заливать видео.
2. Создать новый проект (или использовать существующий) — верхнее меню, **New Project**.
3. В разделе **APIs & Services → Library** найти **YouTube Data API v3** и нажать **Enable**.

## Шаг 2 — Настроить OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. User Type — **External** (если это не Google Workspace-аккаунт с доменом).
3. Заполнить обязательные поля (название приложения, email) — остальное можно оставить по умолчанию.
4. В разделе **Scopes** добавить `https://www.googleapis.com/auth/youtube.upload` (можно найти по поиску "YouTube Data API").
5. В разделе **Test users** добавить свой Google-аккаунт (**обязательно**, пока приложение не прошло верификацию Google — см. предупреждение ниже).

> Пока consent screen в статусе **Testing** — авторизоваться могут только аккаунты из списка Test users, а выданный `refresh_token` может протухать примерно раз в 7 дней (тогда просто нужно будет переподключиться заново в приложении — это не баг). Для личного использования подходит, полная верификация Google не нужна.

## Шаг 3 — Создать OAuth Client ID

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type — **Web application**.
3. В **Authorized redirect URIs** добавить **ровно**:

```
http://localhost:3000/api/youtube/callback
```

4. Нажать Create — Google покажет `Client ID` и `Client secret`, они понадобятся дальше.

## Шаг 4 — Заполнить `.env`

```bash
GOOGLE_OAUTH_CLIENT_ID=<Client ID из шага 3>
GOOGLE_OAUTH_CLIENT_SECRET=<Client secret из шага 3>
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/youtube/callback
```

Если `TOKEN_ENCRYPTION_KEY` ещё не заполнен (использовался и для TikTok, и для YouTube — один и тот же ключ шифрует оба файла токенов):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```bash
TOKEN_ENCRYPTION_KEY=<результат команды выше>
```

## Шаг 5 — Запустить проект

В отличие от TikTok, здесь **не нужен** `dev:https` — Google разрешает обычный http на localhost:

```bash
pnpm dev
```

## Шаг 6 — Подключить аккаунт в интерфейсе

1. Открыть `http://localhost:3000`, дойти до готового видео (после экспорта .mp4) — там блок YouTube с кнопкой **«Подключить YouTube»**.
2. Нажать — откроется экран логина Google. Если consent screen в статусе Testing, Google сначала покажет предупреждение «Google hasn't verified this app» — нужно нажать **Advanced → Go to <название приложения> (unsafe)**, это ожидаемо для тестового режима.
3. Подтвердить разрешение на доступ к YouTube-загрузке.
4. Google вернёт обратно в приложение — кнопка сменится на форму публикации (название, описание, приватность).

## Публикация — в отличие от TikTok, сразу настоящая

У YouTube нет режима «черновик»/«только я по умолчанию» как у TikTok — при публикации сразу нужно выбрать один из трёх уровней:

| Приватность | Что значит |
|---|---|
| `Приватное` | Видит только сам аккаунт |
| `По ссылке` (по умолчанию в форме) | Видит любой, у кого есть прямая ссылка, не индексируется в поиске/на канале |
| `Публичное` | Видно всем, в поиске и на канале |

Загрузка идёт одним PUT-запросом целиком (без чанкинга, как у TikTok) — после завершения сразу приходит `videoId` и ссылка вида `youtube.com/shorts/<id>`.

## Частые проблемы

- **«Google hasn't verified this app»** — нормально для Testing-режима consent screen, продолжить через Advanced (см. шаг 6).
- **«Access blocked: has not completed the Google verification process»** без возможности продолжить — значит забыли добавить свой аккаунт в **Test users** (шаг 2).
- **Google не вернул refresh_token** — приложение уже выдавало токен этому аккаунту раньше и Google не переслал новый. Отозвать доступ на [myaccount.google.com/permissions](https://myaccount.google.com/permissions) и подключить заново.
- **«Подключение к YouTube истекло — подключите аккаунт заново»** — либо естественное протухание тестового `refresh_token` раз в ~7 дней, либо доступ был отозван вручную. Просто «Подключить YouTube» ещё раз.
- **Redirect URI mismatch** — сверить `GOOGLE_OAUTH_REDIRECT_URI` в `.env` и Authorized redirect URIs в Google Cloud Console посимвольно, включая `http` (не `https`).

## Где смотреть код, если что-то непонятно

- `apps/web/lib/youtubeApi.ts` — OAuth + resumable upload
- `apps/web/lib/youtubeTokenStore.ts` — хранение токенов
- `apps/web/app/api/youtube/` — роуты `auth`, `callback`, `publish`, `status`
- `ARCHITECTURE.md` (корень репозитория) — раздел «Этап 7 — Публикация в YouTube»
