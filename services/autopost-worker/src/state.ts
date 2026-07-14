import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { config } from "./config.js";

export interface QueuedVideo {
  driveFileId: string;
  name: string;
  addedAt: string;
}

export interface WorkerState {
  /** FIFO — новые файлы добавляются в конец, публикуем всегда с начала (index 0) */
  queue: QueuedVideo[];
  /** id файлов, которые уже когда-либо видели (в очереди или уже опубликованы) — не даёт добавить повторно */
  knownDriveFileIds: string[];
  /** "YYYY-MM-DD:слот" последнего сработавшего слота расписания — не даёт сработать дважды за одну и ту же минуту опроса */
  lastFiredSlotKey: string | null;
}

const EMPTY_STATE: WorkerState = {
  queue: [],
  knownDriveFileIds: [],
  lastFiredSlotKey: null,
};

/**
 * Состояние — простой JSON-файл, не SQLite: воркеру не нужны выборки/индексы,
 * только "прочитать всё" и "перезаписать всё", а lock не нужен — процесс
 * один (в systemd-юните не задан несколько экземпляров). Каждая мутация
 * читает-меняет-пишет весь файл целиком, что для размеров этой очереди
 * (десятки-сотни видео) пренебрежимо дёшево.
 */
export async function loadState(): Promise<WorkerState> {
  try {
    const raw = await readFile(config.stateFilePath, "utf8");
    return { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<WorkerState>) };
  } catch {
    return { ...EMPTY_STATE };
  }
}

export async function saveState(state: WorkerState): Promise<void> {
  await mkdir(path.dirname(config.stateFilePath), { recursive: true });
  await writeFile(config.stateFilePath, JSON.stringify(state, null, 2), "utf8");
}
