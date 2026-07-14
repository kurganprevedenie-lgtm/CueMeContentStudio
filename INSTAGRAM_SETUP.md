# Как подключить свой Instagram-аккаунт к CueMe Content Studio

## Важно понять сразу — это сложнее, чем TikTok и YouTube

Instagram Content Publishing API устроен иначе:

1. **Публикация идёт не напрямую в Instagram, а через Facebook-страницу.** Нужна Facebook-страница (Page), к которой в Meta Business Suite привязан твой Instagram-аккаунт (он должен быть **Business** или **Creator**, не обычный личный).
2. **Приложение не заливает видео само.** Оно отдаёт Meta публичную HTTPS-ссылку на готовый .mp4 (`/api/render/[jobId]/download`), и Meta сама скачивает файл со своей стороны. Из-за этого **self-signed сертификат (`dev:https`), которого хватало для TikTok, тут не подходит** — нужен настоящий публичный HTTPS-адрес. Локально это означает туннель наружу, например **ngrok**.
3. Как и с TikTok/YouTube, подключение хранится в одном файле на диске (`apps/web/.data/instagram-tokens.enc`) — один аккаунт на экземпляр приложения, своя копия проекта нужна для своего аккаунта.

## Шаг 0 — Проверить сам Instagram-аккаунт

Прежде чем лезть в код: зайди в приложение Instagram → **Настройки → Аккаунт → Переключиться на профессиональный аккаунт** (Business или Creator, не важно какой) — API не работает с обычным личным аккаунтом. Затем в Meta Business Suite (business.facebook.com) убедиться, что этот Instagram-аккаунт привязан к какой-то твоей Facebook-странице (если страницы нет — создать любую, даже пустую).

## Шаг 1 — Установить и настроить ngrok

1. Зарегистрироваться на [ngrok.com](https://ngrok.com/) (бесплатного плана достаточно).
2. Установить ngrok (через `choco install ngrok`, `npm i -g ngrok` или скачать exe с сайта).
3. В личном кабинете ngrok скопировать свой **authtoken** и один раз прописать его:
   ```bash
   ngrok config add-authtoken <твой-токен>
   ```
4. **Важно:** на бесплатном плане обычный `ngrok http 3000` каждый раз выдаёт новый случайный адрес — тогда после каждого перезапуска придётся заново менять redirect URI и в `.env`, и в Meta App Dashboard. Удобнее один раз зарезервировать **бесплатный статический домен** в разделе ngrok **Domains** — тогда адрес не меняется между перезапусками.

## Шаг 2 — Создать приложение в Meta for Developers

1. Зайти на [developers.facebook.com](https://developers.facebook.com/) под своим Facebook-аккаунтом (тем же, что владеет нужной страницей) → **My Apps → Create App**.
2. Тип приложения — **Business**.
3. Заполнить название, привязать Business-аккаунт (или создать новый, Meta предложит сама).

## Шаг 3 — Добавить нужные продукты

В дашборде приложения (**Add Product**) добавить два продукта:
- **Facebook Login for Business** — отвечает за OAuth
- **Instagram** (Instagram Graph API / Content Publishing) — отвечает за саму публикацию

## Шаг 4 — Настроить Facebook Login for Business

1. В настройках продукта **Facebook Login for Business** найти **Valid OAuth Redirect URIs**.
2. Вписать ngrok-адрес (тот, что закрепили в шаге 1) с путём callback, например:
   ```
   https://твой-домен.ngrok-free.app/api/instagram/callback
   ```
3. Сохранить.

## Шаг 5 — Добавить себя в роли приложения (без этого не пустит)

Пока приложение не прошло Meta App Review, авторизоваться и публиковать могут только аккаунты с ролью в приложении:
1. **App roles → Roles** (или **Users and Permissions**) в дашборде.
2. Добавить свой Facebook-аккаунт с ролью **Admin** или **Developer** (обычно ты и так Admin как создатель приложения — просто проверь).
3. Отдельно в разделе **Instagram → Basic Display / API setup** может понадобиться привязать сам Instagram-аккаунт как тестовый — если Meta предложит это сделать, подтвердить со стороны Instagram-приложения на телефоне.

## Шаг 6 — Скопировать App ID и App Secret

**Settings → Basic** в дашборде приложения — там `App ID` и `App Secret` (Secret откроется после нажатия "Show", может попросить пароль от Facebook).

## Шаг 7 — Заполнить `.env`

```bash
FACEBOOK_APP_ID=<App ID из шага 6>
FACEBOOK_APP_SECRET=<App Secret из шага 6>
INSTAGRAM_REDIRECT_URI=https://твой-домен.ngrok-free.app/api/instagram/callback
```

`TOKEN_ENCRYPTION_KEY` уже должен быть заполнен (общий для TikTok/YouTube/Instagram).

## Шаг 8 — Запустить всё вместе

Два процесса параллельно, в двух окнах терминала:

```bash
# окно 1 — обычный dev-сервер, БЕЗ dev:https (ngrok сам даёт https)
pnpm dev
```

```bash
# окно 2 — туннель наружу, на тот же порт 3000
ngrok http 3000 --domain=твой-домен.ngrok-free.app
```

Открывать приложение теперь нужно по ngrok-адресу (`https://твой-домен.ngrok-free.app`), не по `localhost:3000` — иначе видео, которое попытается скачать Meta, не будет доступно снаружи.

## Шаг 9 — Подключить аккаунт

1. На странице готового видео нажать **«Подключить Instagram»**.
2. Войти через Facebook, выбрать нужную Facebook-страницу, подтвердить разрешения (`instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`).
3. Приложение само найдёт привязанный к странице Instagram-аккаунт и подключится.

## Частые проблемы

- **«У вашего Facebook-аккаунта нет ни одной страницы»** — создать Facebook-страницу (Meta Business Suite → Pages → Create Page), даже пустую.
- **«К вашим Facebook-страницам не привязан ни один Instagram-аккаунт»** — привязать Instagram-аккаунт к странице: Meta Business Suite → Settings → Linked accounts → Instagram.
- **Meta не может скачать видео / контейнер зависает в IN_PROGRESS/ERROR** — почти всегда значит, что приложение открыто не через ngrok-домен, а через `localhost`, и `video_url` в контейнере оказался недоступен снаружи.
- **Redirect URI mismatch при входе** — сверить `INSTAGRAM_REDIRECT_URI` в `.env` и Valid OAuth Redirect URIs в Meta Dashboard посимвольно, включая ngrok-домен (он должен совпадать с тем, что реально открыт в браузере в этот момент — бесплатный ngrok без статического домена меняет адрес при каждом перезапуске).
- **«Подключение к Instagram истекло»** — долгоживущий токен (~60 дней) истёк или был отозван — просто подключить заново.

## Где смотреть код, если что-то непонятно

- `apps/web/lib/instagramApi.ts` — OAuth через Facebook, поиск IG-аккаунта, публикация Reels
- `apps/web/lib/instagramTokenStore.ts` — хранение токенов
- `apps/web/app/api/instagram/` — роуты `auth`, `callback`, `publish`, `status`
- `ARCHITECTURE.md` (корень репозитория) — раздел «Этап 8 — Публикация Reels в Instagram»
