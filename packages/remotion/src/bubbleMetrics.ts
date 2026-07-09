/**
 * Базовые (при messageFontScale=1, messageSpacingScale=1) размеры пузыря
 * сообщения. getScaledBubbleMetrics() — ЕДИНСТВЕННОЕ место, где эти базы
 * превращаются в реальные пиксели с учётом настроек пользователя
 * (LayoutSettings). Используется и в самом рендере (ChatVideo.tsx,
 * VideoBubble), и в оценке высоты для анимации роста ChatWindowCard
 * (cardHeight.ts) — если бы каждый считал масштаб по-своему, расчёт
 * высоты снова разъехался бы с тем, что рисуется на самом деле (уже
 * ловили этот баг на фиксированных размерах — с настраиваемыми он же).
 */
export const BASE_BUBBLE_FONT_SIZE = 48;
export const BASE_LABEL_FONT_SIZE = 32;
export const BASE_AVATAR_SIZE = 92;
/** "26px 38px" в исходной вёрстке — верт./гориз. на одну сторону */
export const BASE_BUBBLE_PADDING_VERTICAL = 26;
export const BASE_BUBBLE_PADDING_HORIZONTAL = 38;
/** Добавка к LABEL_FONT_SIZE, дающая высоту строки-подписи + отступ под ней */
export const BASE_SENDER_LABEL_EXTRA = 14;

export const BASE_MESSAGE_ROW_GAP = 24;
export const BASE_MESSAGE_ROW_GAP_SAME_SENDER = 6;
export const BASE_CARD_CONTENT_TOP_PADDING = 20;
export const BASE_CARD_CONTENT_BOTTOM_PADDING = 56;
export const BASE_CARD_CONTENT_SIDE_PADDING = 28;

/**
 * Сколько символов в среднем помещается на одну строку пузыря при
 * bubbleFontSize=BASE_BUBBLE_FONT_SIZE и windowWidthRatio=BASE_WINDOW_WIDTH_RATIO.
 * Приблизительно (без реального замера текста, см. cardHeight.ts) — но
 * должно меняться вместе с размером шрифта и шириной окна, иначе оценка
 * числа строк (а с ней и высота карточки) разъедется с тем, что рисуется
 * на самом деле, когда пользователь двигает соответствующие ползунки.
 */
export const BASE_CHARS_PER_LINE = 18;
/** Ширина окна по умолчанию — точка отсчёта для масштабирования BASE_CHARS_PER_LINE */
export const BASE_WINDOW_WIDTH_RATIO = 0.87;

export interface ScaledBubbleMetrics {
  bubbleFontSize: number;
  labelFontSize: number;
  bubbleLineHeight: number;
  avatarSize: number;
  bubblePaddingVertical: number;
  bubblePaddingHorizontal: number;
  /** Отступ сверху+снизу вместе — для оценки высоты блока сообщения */
  bubbleVerticalPaddingTotal: number;
  senderLabelBlockHeight: number;
  messageRowGap: number;
  messageRowGapSameSender: number;
  cardContentTopPadding: number;
  cardContentBottomPadding: number;
  cardContentSidePadding: number;
  /** Оценка символов на строку — с поправкой на размер шрифта и ширину окна */
  charsPerLine: number;
}

export function getScaledBubbleMetrics(
  fontScale: number,
  spacingScale: number,
  windowWidthRatio: number = BASE_WINDOW_WIDTH_RATIO
): ScaledBubbleMetrics {
  const bubbleFontSize = BASE_BUBBLE_FONT_SIZE * fontScale;
  const labelFontSize = BASE_LABEL_FONT_SIZE * fontScale;
  const bubblePaddingVertical = BASE_BUBBLE_PADDING_VERTICAL * fontScale;
  const widthFactor = windowWidthRatio / BASE_WINDOW_WIDTH_RATIO;

  return {
    bubbleFontSize,
    labelFontSize,
    bubbleLineHeight: bubbleFontSize * 1.35,
    avatarSize: BASE_AVATAR_SIZE * fontScale,
    bubblePaddingVertical,
    bubblePaddingHorizontal: BASE_BUBBLE_PADDING_HORIZONTAL * fontScale,
    bubbleVerticalPaddingTotal: bubblePaddingVertical * 2,
    senderLabelBlockHeight: labelFontSize + BASE_SENDER_LABEL_EXTRA * fontScale,
    messageRowGap: BASE_MESSAGE_ROW_GAP * spacingScale,
    messageRowGapSameSender: BASE_MESSAGE_ROW_GAP_SAME_SENDER * spacingScale,
    cardContentTopPadding: BASE_CARD_CONTENT_TOP_PADDING * spacingScale,
    cardContentBottomPadding: BASE_CARD_CONTENT_BOTTOM_PADDING * spacingScale,
    cardContentSidePadding: BASE_CARD_CONTENT_SIDE_PADDING * spacingScale,
    charsPerLine: Math.max((BASE_CHARS_PER_LINE * widthFactor) / fontScale, 4),
  };
}
