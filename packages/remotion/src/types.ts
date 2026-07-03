import type { ChatTheme, Message } from "@cueme/shared";

/**
 * Тайминг одного сообщения в видео.
 * durationSec считается из реальной длительности аудиофайла
 * (getAudioDurationInSeconds), не из длины текста.
 */
export interface MessageTiming {
  /** id сообщения из Message */
  id: string;
  /** Секунда, на которой сообщение появляется */
  startSec: number;
  /** Сколько секунд сообщение «звучит» (длительность аудио или пауза по умолчанию) */
  durationSec: number;
}

/**
 * Props композиции ChatVideo.
 * ВНИМАНИЕ: контракт рендера — менять только по согласованию (см. ARCHITECTURE.md).
 * Объявлено через type (не interface) — Remotion требует совместимости
 * с Record<string, unknown>.
 */
export type ChatVideoProps = {
  messages: Message[];
  theme: ChatTheme;
  timings: MessageTiming[];
};

export const VIDEO_FPS = 30;
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;

/** Хвост тишины в конце ролика, сек */
const TAIL_SEC = 1;

export function totalDurationInFrames(timings: MessageTiming[]): number {
  const lastEnd = timings.reduce(
    (max, t) => Math.max(max, t.startSec + t.durationSec),
    0
  );
  return Math.max(Math.ceil((lastEnd + TAIL_SEC) * VIDEO_FPS), VIDEO_FPS * 2);
}
