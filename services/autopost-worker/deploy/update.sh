#!/bin/bash
# Та же схема, что и ~/CueMe/auto_update.sh у cueme-bot: cron дёргает этот
# скрипт каждую минуту от обычного пользователя (не системного аккаунта),
# скрипт сам сравнивает HEAD с origin/main и, если есть отличия, подтягивает
# изменения, ставит зависимости и перезапускает systemd-юнит.
cd /home/nikola/CueMeContentStudio

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
    sudo systemctl restart autopost-worker
    echo "$(date): Обновление применено, воркер перезапущен." >> "$LOG"
else
    echo "$(date): Обновлений нет." >> "$LOG"
fi
