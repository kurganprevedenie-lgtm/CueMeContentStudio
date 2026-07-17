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

Рядом с cueme-bot (`~/CueMe`), тем же пользователем — без отдельного системного аккаунта:

```bash
git clone https://github.com/kurganprevedenie-lgtm/CueMeContentStudio.git ~/CueMeContentStudio
cd ~/CueMeContentStudio
pnpm install --filter "autopost-worker..."
```

`--filter "autopost-worker..."` ставит только сам воркер и его рабочую зависимость `@cueme/publish-clients` — без Next.js/Remotion/`sharp` из `apps/web`, которые воркеру не нужны и на слабом сервере ни к чему занимать место (обычный `pnpm install` без фильтра подтянет заодно и их).

Отдельного шага сборки нет — воркер лёгкий, запускается прямо из TypeScript через `tsx` (см. `package.json`), без промежуточного `dist/`. Дальше все пути в примерах — от `services/autopost-worker/`.

## Шаг 5 — перенести уже подключённые токены

TikTok и YouTube теперь поддерживают несколько подключённых аккаунтов одновременно (страница **«Подключённые аккаунты»** → `/accounts` в Content Studio) — у каждого аккаунта свой файл токена: `tiktok-{id}.enc`, `youtube-{id}.enc`, где `{id}` виден на странице `/accounts`. Если ещё остались старые файлы `tiktok-tokens.enc`/`youtube-tokens.enc` (с версии до мультиаккаунта) — не страшно, при первом запуске воркер (точнее, `packages/publish-clients`) сам смигрирует их в новый формат и переименует старый файл в `.migrated`.

На машине, где ты подключал TikTok/YouTube/Instagram в Content Studio, скопируй **все** `.enc`-файлы аккаунтов, которые должен использовать воркер (можно не все — см. шаг 6, `TIKTOK_ACCOUNT_IDS`/`YOUTUBE_ACCOUNT_IDS`):

```bash
scp apps/web/.data/tiktok-*.enc apps/web/.data/youtube-*.enc apps/web/.data/instagram-tokens.enc \
  nikola@сервер:~/CueMeContentStudio/services/autopost-worker/.data/
```

Если какая-то из площадок ещё не подключена — просто не копируй соответствующие файлы и выключи её через `ENABLE_*=false` в `.env` (шаг 6).

## Шаг 6 — заполнить `.env`

```bash
cd services/autopost-worker
cp .env.example .env
```

Открыть `.env` и заполнить:
- `GDRIVE_FOLDER_ID` — ID папки из шага 3
- `GDRIVE_SERVICE_ACCOUNT_KEY_PATH` — оставить `service-account.json`, сам файл положить рядом (`services/autopost-worker/service-account.json`, он в `.gitignore`)
- `TOKEN_ENCRYPTION_KEY`, `TIKTOK_*`, `GOOGLE_OAUTH_*`, `FACEBOOK_*` — **скопировать один в один** из `.env` Content Studio (тот же ключ шифрования, иначе перенесённые `*.enc` не расшифруются)
- `TIKTOK_ACCOUNT_IDS`, `YOUTUBE_ACCOUNT_IDS` — список id аккаунтов через запятую (без пробелов), на которые воркер будет постить **каждое** видео из Drive. У воркера нет своего UI, поэтому выбор аккаунтов — не на каждый пост, а один статический список. id берутся со страницы `/accounts` в Content Studio (там же видно, каким `.enc`-файлам они соответствуют — см. шаг 5). Если платформа включена (`ENABLE_TIKTOK=true`), а список пуст — воркер запустится, но напишет в лог ошибку и будет пропускать эту площадку при каждой публикации.
- `HTTPS_PROXY` — если сервер стоит там, где прямой доступ к TikTok/YouTube нестабилен (частые `TikTok не ответил за 120 секунд` в логе), пропиши сюда HTTP-порт локального VPN-клиента (например `http://127.0.0.1:10809` для Happ — именно HTTP-порт, не SOCKS5, Node это не поддерживает). Пусто — трафик идёт напрямую.

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

Юнит настроен на пользователя `nikola` (та же схема, что у cueme-bot — без отдельного системного аккаунта):

```bash
sudo cp deploy/autopost-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now autopost-worker.service
```

Юнит уже содержит `MemoryMax=256M`, `CPUQuota=25%` и `Restart=on-failure` — процесс лёгкий, лимиты с запасом, но не безграничные, чтобы не мешать `cueme-bot` на том же сервере. Если реальный путь на сервере отличается от `/home/nikola/CueMeContentStudio` — поправь пути в файле перед копированием.

**Node ставился через nvm (в домашней папке), поэтому две вещи, которых нет у cueme-bot (он на системном python):**

1. `ExecStart` в юните вызывает node **абсолютным путём** (`/home/nikola/.nvm/versions/node/v<версия>/bin/node ... tsx src/index.ts`), а не через `PATH` — systemd видит только системный `PATH`, nvm-node в нём нет. Если сменишь версию Node (`nvm install`) — поправь путь в юните (актуальный путь: `which node` на сервере).

2. **SELinux (`getenforce` → `Enforcing`) блокирует запуск nvm-бинарника** из домашней папки (метка `user_home_t`), в отличие от системного python у cueme-bot (`venv/bin/python` → системный `/usr/bin/python3`, метка `bin_t`). Симптом — сервис не стартует, `status=203/EXEC`, а `sudo ausearch -m avc -ts recent` показывает `denied { execute } ... comm="(node)"`. Лечится пометкой самого бинарника `node` как системно-исполняемого:
   ```bash
   sudo semanage fcontext -a -t bin_t "/home/nikola/\.nvm/versions/node/v24\.18\.0/bin/node"
   sudo restorecon -v /home/nikola/.nvm/versions/node/v24.18.0/bin/node
   ```
   (если нет `semanage` — `sudo dnf install -y policycoreutils-python-utils`; быстрый непостоянный вариант — `sudo chcon -t bin_t <путь к node>`). Всё остальное — чтение JS/`.env`, запись логов/состояния в домашнюю папку, сеть — SELinux и так разрешает (это доказывает работающий рядом cueme-bot, который так же живёт в домашней папке).

## Шаг 10 — автообновление с GitHub (cron)

Полностью повторяет схему `~/CueMe/auto_update.sh` у cueme-bot: cron каждую минуту дёргает скрипт, тот сравнивает `HEAD` с `origin/main` и, если есть отличия — подтягивает, ставит зависимости, перезапускает сервис. Никаких GitHub Actions/вебхуков.

1. Разрешить `nikola` перезапускать именно этот юнит без пароля (и только его):
   ```bash
   sudo cp ~/CueMeContentStudio/services/autopost-worker/deploy/autopost-worker-sudoers /etc/sudoers.d/autopost-worker
   sudo chmod 440 /etc/sudoers.d/autopost-worker
   sudo visudo -c
   ```
2. Добавить cron-задачу (как у cueme-bot — своя, не через `-u`):
   ```bash
   crontab -e
   ```
   и добавить строку рядом с уже существующей для `auto_update.sh`:
   ```
   * * * * * /home/nikola/CueMeContentStudio/services/autopost-worker/deploy/update.sh
   ```
3. Проверить руками, что скрипт вообще работает, прежде чем полагаться на cron:
   ```bash
   ~/CueMeContentStudio/services/autopost-worker/deploy/update.sh
   cat ~/CueMeContentStudio/services/autopost-worker/update.log
   ```
   Должна появиться строка «Обновлений нет.» (если `HEAD` и так совпадает с `origin/main`). Проверить, что реальное обновление тоже сработает — сделать пустой коммит и запушить (`git commit --allow-empty -m "test" && git push`), подождать минуту, посмотреть `update.log` — должно появиться «Найдено обновление, применяем...» → «Обновление применено, воркер перезапущен.».

`update.sh` тянет **весь репозиторий** (не только `services/autopost-worker`) и делает `pnpm install` из корня — так подхватятся и изменения в `packages/publish-clients`, от которого воркер зависит. Перезапускается только `autopost-worker.service`, cueme-bot он не трогает. Как и у cueme-bot, лог пишется при **каждой** проверке (даже если обновлений нет) — стоит иногда почистить `update.log`, чтобы не рос бесконечно.

## Проверка и логи

```bash
sudo systemctl status autopost-worker
journalctl -u autopost-worker -f       # живой вывод
tail -f ~/CueMeContentStudio/services/autopost-worker/autopost-worker.log
tail -f ~/CueMeContentStudio/services/autopost-worker/update.log
```

## Частые проблемы

- **«GDRIVE_FOLDER_ID не задан»** — не заполнен `.env`, см. шаг 6.
- **Drive: список файлов пустой, хотя видео в папке есть** — папка не расшарена с `client_email` сервисного аккаунта (шаг 3), либо не тем аккаунтом.
- **«TikTok/YouTube/Instagram не подключён»** — не скопированы `*.enc`-файлы (шаг 5) либо `TOKEN_ENCRYPTION_KEY` в `.env` воркера не совпадает с тем, что был при их сохранении.
- **Слот наступил, но ничего не публикуется** — проверь лог: если там «очередь пуста», значит на момент слота новых видео в Drive не было, это ожидаемое поведение (см. требования — пропускаем, не постим ничего).
- **Instagram: «Meta не обработала видео за отведённое время»** — контейнер завис в `IN_PROGRESS` дольше ~3 минут; обычно временная проблема на стороне Meta, попробует в следующий раз при следующем видео (текущее уже переехало в `posted`, вручную решить, публиковать ли его отдельно).
- **Автообновление не срабатывает** — проверить `update.log`; частая причина — `git pull` отказался мержить из-за локальных изменений/конфликта на сервере (на сервере вообще не должно быть локальных правок — туда только пуш из GitHub, не наоборот) либо `sudoers`-правило не подхватилось (`sudo visudo -c`).

## Где смотреть код, если что-то непонятно

- `services/autopost-worker/src/driveClient.ts` — работа с Google Drive
- `services/autopost-worker/src/schedule.ts` — логика расписания
- `services/autopost-worker/src/publish.ts` — публикация на все три площадки
- `services/autopost-worker/src/index.ts` — главный цикл
- `services/autopost-worker/deploy/update.sh` — скрипт автообновления (cron)
- `packages/publish-clients/` — общий код публикации, тот же, что использует Content Studio
