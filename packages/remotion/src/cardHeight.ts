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
 * насколько вырастить карточку, а не точный замер. Занижено намеренно
 * (с запасом в сторону "лишняя строка"), чтобы не недооценивать перенос.
 */
const CHARS_PER_LINE = 18;

/**
 * Небольшая систематическая погрешность оценки (шрифт/метрики отличаются
 * от предположенных) на одном сообщении незаметна, но на цикле из
 * нескольких сообщений накапливается и к концу цикла пузырь может вылезти
 * за обрезанный край карточки. Запас 30% компенсирует именно это —
 * лучше чуть более высокая карточка, чем обрезанный текст.
 */
const HEIGHT_ESTIMATE_SAFETY_MARGIN = 1.3;

export function estimateMessageBlockHeight(text: string): number {
  const lines = Math.max(1, Math.ceil(text.length / CHARS_PER_LINE));
  const raw =
    SENDER_LABEL_BLOCK_HEIGHT + lines * BUBBLE_LINE_HEIGHT + BUBBLE_VERTICAL_PADDING;
  return raw * HEIGHT_ESTIMATE_SAFETY_MARGIN;
}

/** Сколько секунд идёт анимация роста карточки на каждое новое сообщение */
const GROWTH_DURATION_SEC = 0.4;

interface CycleMessage {
  id: string;
  appearFrame: number;
}

interface Cycle {
  messages: CycleMessage[];
  /** stepHeights[k] — высота карточки, когда в ЭТОМ цикле показано k сообщений; [0] — только шапка */
  stepHeights: number[];
}

/**
 * Разбивает сообщения на "циклы": пока новое сообщение помещается в
 * maxContentHeight — оно добавляется в текущий цикл, карточка растёт.
 * Как только для очередного сообщения места уже не остаётся — оно
 * открывает НОВЫЙ цикл: карточка сбрасывается к высоте одной шапки и
 * снова растёт с нуля с этого сообщения — видео как бы продолжается
 * заново, сообщения предыдущего цикла в новом уже не показываются.
 */
function computeCycles(
  messages: Message[],
  timings: MessageTiming[],
  fps: number,
  headerHeight: number,
  maxContentHeight: number,
  maxCardHeight: number
): Cycle[] {
  const timingById = new Map(timings.map((t) => [t.id, t]));
  const shown = messages.filter((m) => timingById.has(m.id));

  const cycles: Cycle[] = [];
  let current: Cycle = { messages: [], stepHeights: [headerHeight] };
  let rawContentHeight = 0;

  for (const message of shown) {
    const blockHeight = estimateMessageBlockHeight(message.text);
    const gapIfNotFirst = current.messages.length === 0 ? 0 : MESSAGE_ROW_GAP;
    const projectedContent =
      rawContentHeight +
      blockHeight +
      gapIfNotFirst +
      CARD_CONTENT_TOP_PADDING +
      CARD_CONTENT_BOTTOM_PADDING;

    // не первое в цикле и уже не помещается — начинаем новый цикл
    if (current.messages.length > 0 && projectedContent > maxContentHeight) {
      cycles.push(current);
      current = { messages: [], stepHeights: [headerHeight] };
      rawContentHeight = 0;
    }

    const gap = current.messages.length === 0 ? 0 : MESSAGE_ROW_GAP;
    rawContentHeight += blockHeight + gap;
    const contentWithPadding = Math.min(
      rawContentHeight + CARD_CONTENT_TOP_PADDING + CARD_CONTENT_BOTTOM_PADDING,
      maxContentHeight
    );

    current.messages.push({
      id: message.id,
      appearFrame: Math.floor(timingById.get(message.id)!.startSec * fps),
    });
    current.stepHeights.push(
      Math.min(headerHeight + contentWithPadding, maxCardHeight)
    );
  }
  cycles.push(current);
  return cycles;
}

export interface CardStateParams {
  frame: number;
  fps: number;
  messages: Message[];
  timings: MessageTiming[];
  headerHeight: number;
  /** Целевая (максимальная) высота карточки внутри одного цикла */
  maxCardHeight: number;
}

export interface CardState {
  height: number;
  /** id сообщений текущего цикла — только их нужно рисовать в списке */
  visibleMessageIds: Set<string>;
}

/**
 * Высота ChatWindowCard и набор видимых сообщений на конкретном кадре.
 *
 * Внутри цикла: стартует с высоты одной шапки и с каждым новым сообщением
 * плавно (interpolate по кадрам, не мгновенный скачок) дорастает до
 * размера, вмещающего это сообщение — пока не упрётся в maxCardHeight.
 * Когда очередное сообщение уже не помещается — начинается новый цикл:
 * высота мгновенно возвращается к шапке и рост начинается заново с этого
 * сообщения (см. computeCycles).
 */
export function getCardState({
  frame,
  fps,
  messages,
  timings,
  headerHeight,
  maxCardHeight,
}: CardStateParams): CardState {
  const maxContentHeight = Math.max(maxCardHeight - headerHeight, 0);
  const cycles = computeCycles(
    messages,
    timings,
    fps,
    headerHeight,
    maxContentHeight,
    maxCardHeight
  );

  // последний цикл, в котором уже есть хоть одно показанное сообщение
  let activeCycle: Cycle = cycles[0];
  let visibleCount = 0;
  for (const cycle of cycles) {
    const shownCount = cycle.messages.filter((m) => frame >= m.appearFrame).length;
    if (shownCount === 0) break;
    activeCycle = cycle;
    visibleCount = shownCount;
  }

  if (visibleCount === 0) {
    return { height: activeCycle.stepHeights[0], visibleMessageIds: new Set() };
  }

  const growthFrames = Math.max(Math.round(GROWTH_DURATION_SEC * fps), 1);
  const stepStartFrame = activeCycle.messages[visibleCount - 1].appearFrame;
  const progress = interpolate(
    frame,
    [stepStartFrame, stepStartFrame + growthFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const height = interpolate(progress, [0, 1], [
    activeCycle.stepHeights[visibleCount - 1],
    activeCycle.stepHeights[visibleCount],
  ]);

  const visibleMessageIds = new Set(
    activeCycle.messages.slice(0, visibleCount).map((m) => m.id)
  );

  return { height, visibleMessageIds };
}
