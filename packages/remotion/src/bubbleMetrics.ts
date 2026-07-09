/**
 * Общие размеры пузыря сообщения — используются и в самом рендере
 * (ChatVideo.tsx, VideoBubble), и в оценке высоты для анимации роста
 * ChatWindowCard (cardHeight.ts). Вынесены сюда, чтобы расчёт высоты не
 * мог разъехаться с тем, как пузырь рисуется на самом деле.
 */
export const BUBBLE_FONT_SIZE = 48;
export const LABEL_FONT_SIZE = 32;
export const BUBBLE_LINE_HEIGHT = BUBBLE_FONT_SIZE * 1.35;
/** "26px 38px" — верх+низ */
export const BUBBLE_VERTICAL_PADDING = 26 * 2;
/** Строка с именем отправителя над пузырём + отступ под ней */
export const SENDER_LABEL_BLOCK_HEIGHT = LABEL_FONT_SIZE + 14;
/** gap между соседними сообщениями в списке */
export const MESSAGE_ROW_GAP = 24;

export const CARD_CONTENT_TOP_PADDING = 20;
export const CARD_CONTENT_BOTTOM_PADDING = 56;
