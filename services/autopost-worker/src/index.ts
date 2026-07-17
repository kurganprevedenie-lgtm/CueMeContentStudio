import { config } from "./config.js";
import { initLogger, logger } from "./logger.js";
import { listVideosInFolder, moveFileToPosted } from "./driveClient.js";
import { publishVideo } from "./publish.js";
import { getDueSlotKey, loadSchedule } from "./schedule.js";
import { loadState, saveState } from "./state.js";

initLogger(config.logFilePath);

/** Раз в ~20-30 сек достаточно для секундной точности слотов расписания — не нагружает "слабый сервер" */
const SCHEDULE_CHECK_INTERVAL_MS = 20_000;

let isPollingDrive = false;
let isPublishing = false;

/**
 * Опрашивает целевую папку на Drive и добавляет в очередь всё, чего мы ещё
 * не видели (по id файла — надёжнее, чем курсор по modifiedTime: не зависит
 * от того, не пропустили ли предыдущий опрос из-за рестарта процесса).
 */
async function pollDrive(): Promise<void> {
  if (isPollingDrive) return;
  isPollingDrive = true;
  try {
    const state = await loadState();
    const known = new Set(state.knownDriveFileIds);
    const files = await listVideosInFolder();
    const newFiles = files.filter((f) => !known.has(f.id));

    if (newFiles.length === 0) return;

    for (const file of newFiles) {
      state.queue.push({
        driveFileId: file.id,
        name: file.name,
        addedAt: new Date().toISOString(),
        // проставляем аккаунты сейчас, не в момент публикации — см. QueuedVideo.accountIds
        accountIds: {
          tiktok: config.enableTikTok ? config.tiktokAccountIds : [],
          youtube: config.enableYouTube ? config.youtubeAccountIds : [],
        },
      });
      state.knownDriveFileIds.push(file.id);
      logger.info(`Drive: новое видео в очереди — "${file.name}" (${file.id})`);
    }
    await saveState(state);
  } catch (e: unknown) {
    logger.error(
      `Drive: не удалось опросить папку — ${e instanceof Error ? e.message : String(e)}`
    );
  } finally {
    isPollingDrive = false;
  }
}

/**
 * Проверяет расписание — если наступил слот и в очереди есть видео,
 * публикует первое (FIFO) на все включённые площадки и убирает его из
 * очереди + перемещает файл в Drive в подпапку "posted". Если слот наступил,
 * а очередь пуста — просто пропускаем, ничего не постим (как и просили).
 */
async function checkSchedule(): Promise<void> {
  if (isPublishing) return;

  let schedule;
  try {
    schedule = await loadSchedule();
  } catch (e: unknown) {
    logger.error(
      `Расписание: не удалось прочитать ${config.scheduleConfigPath} — ${e instanceof Error ? e.message : String(e)}`
    );
    return;
  }

  const state = await loadState();
  const slotKey = getDueSlotKey(schedule, new Date(), state.lastFiredSlotKey);
  if (!slotKey) return;

  // Слот наступил — сразу фиксируем lastFiredSlotKey, даже если очередь
  // пуста, иначе следующий опрос через 20 сек снова увидит тот же слот
  state.lastFiredSlotKey = slotKey;

  const next = state.queue[0];
  if (!next) {
    logger.info(`Расписание: слот ${slotKey} наступил, но очередь пуста — пропускаю`);
    await saveState(state);
    return;
  }

  isPublishing = true;
  try {
    logger.info(`Расписание: слот ${slotKey} — публикую "${next.name}" (${next.driveFileId})`);
    const results = await publishVideo(next);
    for (const r of results) {
      const label = r.accountId ? `${r.platform}:${r.accountId}` : r.platform;
      if (r.ok) {
        logger.info(`  [${label}] опубликовано — ${r.detail}`);
      } else {
        logger.error(`  [${label}] ошибка — ${r.detail}`);
      }
    }

    // Убираем из очереди и переносим файл в Drive в "posted" в любом случае —
    // повторная попытка вручную (переподключить/поправить) проще, чем риск
    // задвоенной публикации туда, где она всё же прошла успешно
    state.queue.shift();
    await saveState(state);
    try {
      await moveFileToPosted(next.driveFileId);
    } catch (e: unknown) {
      logger.error(
        `Drive: не удалось переместить "${next.name}" в posted — ${e instanceof Error ? e.message : String(e)}`
      );
    }
  } catch (e: unknown) {
    logger.error(
      `Публикация "${next.name}" упала целиком — ${e instanceof Error ? e.message : String(e)}`
    );
    await saveState(state);
  } finally {
    isPublishing = false;
  }
}

async function main(): Promise<void> {
  logger.info(
    `autopost-worker запущен — Drive-опрос раз в ${config.drivePollIntervalMin} мин, ` +
      `площадки: ${[
        config.enableTikTok && "tiktok",
        config.enableYouTube && "youtube",
        config.enableInstagram && "instagram",
      ]
        .filter(Boolean)
        .join(", ") || "нет ни одной (проверьте ENABLE_* в .env)"}`
  );
  if (config.enableTikTok && config.tiktokAccountIds.length === 0) {
    logger.error(
      "ENABLE_TIKTOK=true, но TIKTOK_ACCOUNT_IDS пуст — публикация в TikTok будет пропускаться"
    );
  }
  if (config.enableYouTube && config.youtubeAccountIds.length === 0) {
    logger.error(
      "ENABLE_YOUTUBE=true, но YOUTUBE_ACCOUNT_IDS пуст — публикация в YouTube будет пропускаться"
    );
  }

  await pollDrive();
  const driveInterval = setInterval(
    () => void pollDrive(),
    config.drivePollIntervalMin * 60_000
  );
  const scheduleInterval = setInterval(
    () => void checkSchedule(),
    SCHEDULE_CHECK_INTERVAL_MS
  );

  const shutdown = (signal: string) => {
    logger.info(`Получен ${signal} — завершаюсь`);
    clearInterval(driveInterval);
    clearInterval(scheduleInterval);
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

void main();
