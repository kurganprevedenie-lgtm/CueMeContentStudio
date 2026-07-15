#!/bin/bash
# Та же схема, что и ~/CueMe/auto_update.sh у cueme-bot: cron дёргает этот
# скрипт каждую минуту от обычного пользователя (не системного аккаунта),
# скрипт сам сравнивает HEAD с origin/main и, если есть отличия, подтягивает
# изменения, ставит зависимости и перезапускает systemd-юнит.
cd /home/nikola/CueMeContentStudio

# cron видит только системный PATH, без nvm (Node тут стоит через nvm, в
# домашней папке) — без этого "pnpm" внутри скрипта не найдётся, тот же
# эффект, что EnvironmentFile/шебанг ловили в autopost-worker.service.
# Версию поправить, если сменится (см. `which node` на сервере).
export PATH="/home/nikola/.nvm/versions/node/v24.18.0/bin:$PATH"

LOG=/home/nikola/CueMeContentStudio/services/autopost-worker/update.log

git fetch origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "$(date): Найдено обновление, применяем..." >> "$LOG"
    git pull origin main >> "$LOG" 2>&1
    if [ $? -ne 0 ]; then
        echo "$(date): ОШИБКА при git pull! Обновление НЕ применено." >> "$LOG"
        exit 1
    fi
    # --filter autopost-worker... — ставит только сам воркер и его рабочую
    # зависимость @cueme/publish-clients, а не весь монорепо (Next.js/Remotion
    # из apps/web воркеру не нужны и не должны занимать место на слабом сервере)
    pnpm install --filter "autopost-worker..." >> "$LOG" 2>&1
    # полное имя ".service" — должно посимвольно совпадать с правилом в
    # autopost-worker-sudoers, иначе sudo всё равно спросит пароль (а у cron
    # его ввести некому), см. NOPASSWD там
    sudo /usr/bin/systemctl restart autopost-worker.service
    echo "$(date): Обновление применено, воркер перезапущен." >> "$LOG"
else
    echo "$(date): Обновлений нет." >> "$LOG"
fi
