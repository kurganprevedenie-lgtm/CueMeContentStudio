#!/bin/bash
# Та же идея, что и ~/CueMe/auto_update.sh у cueme-bot: cron дёргает скрипт
# каждую минуту, тот сравнивает HEAD с origin/main и при отличии подтягивает
# изменения, ставит зависимости и перезапускает сервис.
#
# Два отличия от наивной версии — защита от "слабого сервера" с нестабильной
# сетью до GitHub:
#  1. flock -n: если предыдущий запуск ещё идёт (git завис на сети), новый
#     минутный запуск просто выходит, а не плодит параллельные git-процессы.
#  2. timeout на git: зависший fetch/pull умирает через 60с и освобождает
#     lock, вместо бесконечного зависания.

# Одновременно только один экземпляр (см. п.1)
exec 9>/tmp/autopost-worker-update.lock
flock -n 9 || exit 0

# cron видит только системный PATH, без nvm (Node тут стоит через nvm, в
# домашней папке) — иначе "pnpm" внутри скрипта не найдётся.
export PATH="/home/nikola/.nvm/versions/node/v24.18.0/bin:$PATH"

cd /home/nikola/CueMeContentStudio

LOG=/home/nikola/CueMeContentStudio/services/autopost-worker/update.log

if ! timeout 60 git fetch origin main >> "$LOG" 2>&1; then
    echo "$(date): git fetch не удался или таймаут (GitHub недоступен?) — пропускаю" >> "$LOG"
    exit 0
fi

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "$(date): Найдено обновление, применяем..." >> "$LOG"
    if ! timeout 60 git pull origin main >> "$LOG" 2>&1; then
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
fi
