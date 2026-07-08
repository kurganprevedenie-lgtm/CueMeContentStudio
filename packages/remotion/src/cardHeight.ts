import { interpolate } from "remotion";
import type { Message } from "@cueme/shared";

import {
  BUBBLE_LINE_HEIGHT,
  BUBBLE_VERTICAL_PADDING,
  CARD_CONTENT_BOTTOM_PADDING,
  CARD_CONTENT_TOP_PADDING,
  MESSAGE_ROW_GAP,
  SENDER_LABEL_BLOCK_HEIGHT,
} from "./bubbleMetrics";
import type { MessageTiming } from "./types";

/**
 * Грубая оценка ширины пузыря в символах на строку при BUBBLE_FONT_SIZE.
 * Remotion считает высоту кадра вне браузерного layout (без реального
 * замера текста), поэтому это ПРИБЛИЖЕНИЕ — только чтобы прикинуть,
 * насколько вырастить карточку, а не точный замер.
 */
const CHARS_PER_LINE = 22;

export function estimateMessageBlockHeight(text: string): number {
  const lines = Math.max(1, Math.ceil(text.length / CHARS_PER_LINE));
  return (
    SENDER_LABEL_BLOCK_HEIGHT + lines * BUBBLE_LINE_HEIGHT + BUBBLE_VERTICAL_PADDING
  );
}

/** Сколько секунд идёт анимация роста карточки на каждое новое сообщение */
const GROWTH_DURATION_SEC = 0.4;

export interface CurrentCardHeightParams {
  frame: number;
  fps: number;
  messages: Message[];
  timings: MessageTiming[];
  headerHeight: number;
  /** Целевая (максимальная) высота карточки — дальше она не растёт */
  maxCardHeight: number;
}

/**
 * Высота ChatWindowCard на конкретном кадре.
 *
 * Стартует с высоты одной шапки (сообщений ещё не показано), и с каждым
 * новым сообщением плавно (interpolate по кадрам, не мгновенный скачок)
 * дорастает до размера, вмещающего это сообщение — пока не упрётся в
 * maxCardHeight, после чего высота больше не меняется (дальше работает
 * обычная логика overflow: hidden внутри уже существующей карточки).
 */
export function currentCardHeight({
  frame,
  fps,
  messages,
  timings,
  headerHeight,
  maxCardHeight,
}: CurrentCardHeightParams): number {
  const timingById = new Map(timings.map((t) => [t.id, t]));
  const shownMessages = messages.filter((m) => timingById.has(m.id));
  const appearFrames = shownMessages.map((m) =>
    Math.floor(timingById.get(m.id)!.startSec * fps)
  );

  const maxContentHeight = Math.max(maxCardHeight - headerHeight, 0);

  // stepHeights[k] — целевая высота карточки, когда видно ровно k сообщений
  const stepHeights: number[] = [headerHeight];
  let rawContentHeight = 0;
  shownMessages.forEach((message, i) => {
    rawContentHeight +=
      estimateMessageBlockHeight(message.text) + (i === 0 ? 0 : MESSAGE_ROW_GAP);
    const contentWithPadding = Math.min(
      rawContentHeight + CARD_CONTENT_TOP_PADDING + CARD_CONTENT_BOTTOM_PADDING,
      maxContentHeight
    );
    stepHeights.push(Math.min(headerHeight + contentWithPadding, maxCardHeight));
  });

  const visibleCount = appearFrames.filter((f) => frame >= f).length;
  if (visibleCount === 0) return stepHeights[0];

  const growthFrames = Math.max(Math.round(GROWTH_DURATION_SEC * fps), 1);
  const stepStartFrame = appearFrames[visibleCount - 1];
  const progress = interpolate(
    frame,
    [stepStartFrame, stepStartFrame + growthFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return interpolate(progress, [0, 1], [
    stepHeights[visibleCount - 1],
    stepHeights[visibleCount],
  ]);
}
