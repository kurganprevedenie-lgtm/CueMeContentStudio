import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Простой файловый логгер без внешних зависимостей (pino/winston были бы
 * оверкиллом для лёгкого фонового процесса) — одна строка на событие,
 * timestamp + уровень + сообщение, пишется и в файл (смотреть потом через
 * ssh), и в stdout (попадает в journalctl вместе с остальным выводом
 * systemd-юнита).
 */
export type LogLevel = "info" | "warn" | "error";

let logFilePath: string | null = null;

export function initLogger(filePath: string): void {
  logFilePath = filePath;
}

function formatLine(level: LogLevel, message: string): string {
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
}

async function writeToFile(line: string): Promise<void> {
  if (!logFilePath) return;
  try {
    await mkdir(path.dirname(logFilePath), { recursive: true });
    await appendFile(logFilePath, line + "\n", "utf8");
  } catch {
    // лог — не критичный путь: если файл недоступен (например, ещё не
    // примонтирован диск), не роняем процесс из-за этого
  }
}

function log(level: LogLevel, message: string): void {
  const line = formatLine(level, message);
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
  void writeToFile(line);
}

export const logger = {
  info: (message: string) => log("info", message),
  warn: (message: string) => log("warn", message),
  error: (message: string) => log("error", message),
};
