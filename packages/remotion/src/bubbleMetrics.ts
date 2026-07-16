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

/**
 * Прикреплённое к сообщению фото вписывается в эту рамку ("object-fit:
 * contain"), а не растягивается по реальным пикселям файла — иначе один
 * портретный кадр с телефона мог бы раздуть карточку на весь экран.
 * Пересчитывается в конкретные width/height через getImageDisplaySize()
 * ниже — то же самое значение использует и рендер (VideoBubble), и оценка
 * высоты (cardHeight.ts), поэтому они не могут разъехаться.
 */
export const BASE_IMAGE_MAX_WIDTH = 480;
export const BASE_IMAGE_MAX_HEIGHT = 480;
/** Отступ между фото и текстом, если у сообщения есть и то, и другое */
export const BASE_IMAGE_TEXT_GAP = 10;

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
  imageMaxWidth: number;
  imageMaxHeight: number;
  imageTextGap: number;
}

/**
 * Вписывает реальное соотношение сторон фото в рамку
 * metrics.imageMaxWidth×imageMaxHeight ("object-fit: contain"), возвращая
 * точные width/height в пикселях кадра — единственное место, где это
 * считается, чтобы рендер (VideoBubble) и оценка высоты (cardHeight.ts)
 * гарантированно совпадали.
 */
export function getImageDisplaySize(
  aspectRatio: number,
  metrics: Pick<ScaledBubbleMetrics, "imageMaxWidth" | "imageMaxHeight">
): { width: number; height: number } {
  const safeRatio = aspectRatio > 0 ? aspectRatio : 1;
  let width = metrics.imageMaxWidth;
  let height = width / safeRatio;
  if (height > metrics.imageMaxHeight) {
    height = metrics.imageMaxHeight;
    width = height * safeRatio;
  }
  return { width, height };
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
    imageMaxWidth: BASE_IMAGE_MAX_WIDTH * fontScale,
    imageMaxHeight: BASE_IMAGE_MAX_HEIGHT * fontScale,
    imageTextGap: BASE_IMAGE_TEXT_GAP * spacingScale,
  };
}
