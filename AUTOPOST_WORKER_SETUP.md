# autopost-worker — деплой и настройка

## Что это

Отдельный лёгкий Node.js-сервис (`services/autopost-worker`), не часть Next.js-приложения Content Studio. Раз в несколько минут проверяет папку на Google Drive, складывает новые видео в очередь (FIFO) и по расписанию (дни недели + время из `config/schedule.json`) публикует их по одному сразу на TikTok, YouTube и Instagram — переиспользуя тот же код, что и Content Studio (`packages/publish-clients`), просто без веб-интерфейса.

## Важно понять сразу: токены не создаются заново

У TikTok/YouTube/Instagram нет service-account-режима (в отличие от Google Drive) — воркер не может пройти OAuth-логин сам, без браузера. Поэтому он **переиспользует уже подключённые аккаунты** из Content Studio: нужно один раз скопировать зашифрованные файлы токенов на сервер воркера. Никакого повторного логина в TikTok/YouTube/Instagram проходить не нужно — только в Google Drive (через service account, см. ниже).

## Архитектура на пальцах

```
Google Drive (папка)
      │  раз в N минут: список новых файлов
      ▼
  очередь (data/state.json, FIFO)
      │  расписание проверяется раз в ~20 сек
      ▼  наступил слот и очередь не пуста
  скачать во временный файл → опубликовать на все включённые площадки → удалить временный файл
      │
      ▼
  переместить файл в Drive в подпапку "posted"
```

## Шаг 1 — Node.js на сервере

Нужен Node.js 18+ на сервере, где будет крутиться воркер (том самом «слабом сервере» рядом с cueme-bot).

```bash
node -v   # проверить, что уже стоит
```

## Шаг 2 — Google Cloud Console: service account для Drive

1. [console.cloud.google.com](https://console.cloud.google.com/) → тот же или новый проект → **APIs & Services → Library** → найти **Google Drive API** → **Enable**.
2. **APIs & Services → Credentials → Create Credentials → Service account**.
3. Заполнить имя (например `autopost-worker`), роль проекта не обязательна (доступ к самой папке настраивается отдельно, шаг 3).
4. Открыть созданный service account → вкладка **Keys** → **Add Key → Create new key → JSON** — скачается файл, это и есть `service-account.json`.

## Шаг 3 — расшарить папку на Drive с сервисным аккаунтом

У service account нет своего Drive — доступ есть только к тому, что ему явно открыли:

1. Открыть JSON-ключ, скопировать `client_email` (выглядит как `autopost-worker@<project>.iam.gserviceaccount.com`).
2. В Google Drive открыть целевую папку с видео → **Поделиться** → вставить этот email → роль **Редактор** (нужна запись — воркер перемещает файлы в `posted`).
3. Скопировать ID папки из адресной строки: `drive.google.com/drive/folders/`**`ЭТОТ_ID`**.

## Шаг 4 — выложить код на сервер

```bash
git clone <ссылка-на-репозиторий> /opt/cueme-content-studio
cd /opt/cueme-content-studio
pnpm install
```

Отдельного шага сборки нет — воркер лёгкий, запускается прямо из TypeScript через `tsx` (см. `package.json`), без промежуточного `dist/`. Дальше все пути в примерах — от `services/autopost-worker/`.

## Шаг 5 — перенести уже подключённые токены

На машине, где ты подключал TikTok/YouTube/Instagram в Content Studio (`apps/web/.data/*.enc`):

```bash
scp apps/web/.data/tiktok-tokens.enc apps/web/.data/youtube-tokens.enc apps/web/.data/instagram-tokens.enc \
  user@сервер:/opt/cueme-content-studio/services/autopost-worker/.data/
```

Если какая-то из площадок ещё не подключена — просто не копируй соответствующий файл и выключи её через `ENABLE_*=false` в `.env` (шаг 6).

## Шаг 6 — заполнить `.env`

```bash
cd services/autopost-worker
cp .env.example .env
```

Открыть `.env` и заполнить:
- `GDRIVE_FOLDER_ID` — ID папки из шага 3
- `GDRIVE_SERVICE_ACCOUNT_KEY_PATH` — оставить `service-account.json`, сам файл положить рядом (`services/autopost-worker/service-account.json`, он в `.gitignore`)
- `TOKEN_ENCRYPTION_KEY`, `TIKTOK_*`, `GOOGLE_OAUTH_*`, `FACEBOOK_*` — **скопировать один в один** из `.env` Content Studio (тот же ключ шифрования, иначе перенесённые `*.enc` не расшифруются)

## Шаг 7 — расписание

```bash
cp config/schedule.example.json config/schedule.json
```

Отредактировать под себя:

```json
{
  "timezone": "Europe/Moscow",
  "slots": [
    { "dayOfWeek": "tuesday", "time": "17:00" },
    { "dayOfWeek": "friday", "time": "19:00" }
  ]
}
```

`dayOfWeek` — `monday`…`sunday`, `time` — `HH:MM` в 24-часовом формате, в указанной таймзоне (не в таймзоне сервера — можно держать сервер в UTC и не пересчитывать вручную).

## Шаг 8 — быстрая проверка без systemd

```bash
pnpm start
```

Должно появиться сообщение в консоли и в `autopost-worker.log` про запуск и список включённых площадок. `Ctrl+C` — остановить.

## Шаг 9 — systemd

```bash
sudo useradd --system --no-create-home autopost || true
sudo cp deploy/autopost-worker.service /etc/systemd/system/
```

Отредактировать в скопированном юните пути `/opt/autopost-worker` на реальный путь (`/opt/cueme-content-studio/services/autopost-worker`), и владельца файлов:

```bash
sudo chown -R autopost:autopost /opt/cueme-content-studio/services/autopost-worker
sudo systemctl daemon-reload
sudo systemctl enable --now autopost-worker.service
```

Юнит уже содержит `MemoryMax=256M`, `CPUQuota=25%` и `Restart=on-failure` — процесс лёгкий, лимиты с запасом, но не безграничные, чтобы не мешать `cueme-bot` на том же сервере.

## Проверка и логи

```bash
sudo systemctl status autopost-worker
journalctl -u autopost-worker -f       # живой вывод
tail -f /opt/cueme-content-studio/services/autopost-worker/autopost-worker.log
```

## Частые проблемы

- **«GDRIVE_FOLDER_ID не задан»** — не заполнен `.env`, см. шаг 6.
- **Drive: список файлов пустой, хотя видео в папке есть** — папка не расшарена с `client_email` сервисного аккаунта (шаг 3), либо не тем аккаунтом.
- **«TikTok/YouTube/Instagram не подключён»** — не скопированы `*.enc`-файлы (шаг 5) либо `TOKEN_ENCRYPTION_KEY` в `.env` воркера не совпадает с тем, что был при их сохранении.
- **Слот наступил, но ничего не публикуется** — проверь лог: если там «очередь пуста», значит на момент слота новых видео в Drive не было, это ожидаемое поведение (см. требования — пропускаем, не постим ничего).
- **Instagram: «Meta не обработала видео за отведённое время»** — контейнер завис в `IN_PROGRESS` дольше ~3 минут; обычно временная проблема на стороне Meta, попробует в следующий раз при следующем видео (текущее уже переехало в `posted`, вручную решить, публиковать ли его отдельно).

## Где смотреть код, если что-то непонятно

- `services/autopost-worker/src/driveClient.ts` — работа с Google Drive
- `services/autopost-worker/src/schedule.ts` — логика расписания
- `services/autopost-worker/src/publish.ts` — публикация на все три площадки
- `services/autopost-worker/src/index.ts` — главный цикл
- `packages/publish-clients/` — общий код публикации, тот же, что использует Content Studio
