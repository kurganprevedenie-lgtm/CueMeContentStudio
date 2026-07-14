import { readFile } from "node:fs/promises";

import { config } from "./config.js";

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface ScheduleSlot {
  dayOfWeek: DayOfWeek;
  /** "HH:MM", 24-часовой формат, в таймзоне schedule.timezone */
  time: string;
}

export interface Schedule {
  /** IANA-таймзона (например "Europe/Moscow") — слоты заданы в ней, не в таймзоне сервера */
  timezone: string;
  slots: ScheduleSlot[];
}

export async function loadSchedule(): Promise<Schedule> {
  const raw = await readFile(config.scheduleConfigPath, "utf8");
  const parsed = JSON.parse(raw) as Schedule;
  if (!parsed.timezone || !Array.isArray(parsed.slots)) {
    throw new Error(
      `${config.scheduleConfigPath} должен содержать { timezone, slots[] } — см. config/schedule.example.json`
    );
  }
  return parsed;
}

function currentDayOfWeek(now: Date, timezone: string): DayOfWeek {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  }).format(now);
  return weekday.toLowerCase() as DayOfWeek;
}

function currentTimeHHMM(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

function currentDateKey(now: Date, timezone: string): string {
  // en-CA форматирует как YYYY-MM-DD — удобный ключ даты без ручной сборки строки
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
}

/**
 * Слот считается "наступившим", если текущие день недели+HH:MM (в таймзоне
 * расписания) совпадают с одним из слотов — воркер опрашивает это раз в
 * ~20-30 секунд (см. index.ts), так что совпадение по минуте не пропустится.
 * lastFiredSlotKey из state.json не даёт сработать повторно в течение той же
 * минуты (или при следующем опросе той же минуты после перезапуска процесса).
 * Возвращает null, если сейчас не время слота или он уже сработал сегодня.
 */
export function getDueSlotKey(
  schedule: Schedule,
  now: Date,
  lastFiredSlotKey: string | null
): string | null {
  const day = currentDayOfWeek(now, schedule.timezone);
  const time = currentTimeHHMM(now, schedule.timezone);
  const dateKey = currentDateKey(now, schedule.timezone);

  const matchedSlot = schedule.slots.find(
    (slot) => slot.dayOfWeek === day && slot.time === time
  );
  if (!matchedSlot) return null;

  const slotKey = `${dateKey}:${matchedSlot.dayOfWeek}:${matchedSlot.time}`;
  if (slotKey === lastFiredSlotKey) return null;
  return slotKey;
}
