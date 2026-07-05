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

/** Когда на видео показывать бейдж-подсказку от CueMe и сколько секунд он виден */
export interface SuggestionTiming {
  startSec: number;
  durationSec: number;
}

/** Текст (и, если озвучен, аудио) подсказки-бейджа */
export interface SuggestionContent {
  text: string;
  audioUrl?: string;
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
  suggestion?: SuggestionContent | null;
  suggestionTiming?: SuggestionTiming | null;
};

export const VIDEO_FPS = 30;
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;

/** Хвост тишины в конце ролика, сек */
const TAIL_SEC = 1;

export function totalDurationInFrames(
  timings: MessageTiming[],
  suggestionTiming?: SuggestionTiming | null
): number {
  let lastEnd = timings.reduce(
    (max, t) => Math.max(max, t.startSec + t.durationSec),
    0
  );
  if (suggestionTiming) {
    lastEnd = Math.max(
      lastEnd,
      suggestionTiming.startSec + suggestionTiming.durationSec
    );
  }
  return Math.max(Math.ceil((lastEnd + TAIL_SEC) * VIDEO_FPS), VIDEO_FPS * 2);
}
