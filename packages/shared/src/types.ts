export interface Message {
  id: string;
  sender: string;
  text: string;
  side: "left" | "right";
  avatarUrl?: string;
  /** data-URL сгенерированной озвучки (этап 3+) */
  audioUrl?: string;
}

/** Один из двух постоянных участников переписки */
export interface Participant {
  name: string;
  avatarUrl?: string;
}

/**
 * Подсказка от CueMe — бейдж с логотипом и текстом, который на видео
 * выезжает снизу после определённого сообщения и плавно исчезает.
 */
export interface Suggestion {
  text: string;
  voiceId?: string;
  /** data-URL озвучки текста подсказки (генерируется через ElevenLabs) */
  audioUrl?: string;
  /**
   * id сообщения, после которого показывать подсказку.
   * null — «после последнего сообщения» (динамически, всегда в конце текущего диалога)
   */
  afterMessageId: string | null;
}

/** Фоновое видео (gameplay-заливка), выбранное для ролика */
export interface BackgroundSettings {
  /** id = имя файла в apps/web/public/backgrounds */
  backgroundId: string | null;
  /** 0..1 */
  volume: number;
  /** 0..1 — затемнение поверх видео для читаемости пузырей */
  overlayOpacity: number;
}

/**
 * Настраиваемая геометрия окна переписки и текста сообщений — конструктор,
 * которым пользователь сам подгоняет размер/расположение окна, размер
 * текста и отступы между сообщениями. Используется и в сторе (для UI),
 * и в самой Remotion-композиции (packages/remotion), поэтому лежит здесь,
 * в общем пакете, а не дублируется в обоих местах.
 */
export interface LayoutSettings {
  /** 0..1 — доля ширины кадра под окно переписки */
  windowWidthRatio: number;
  /** 0..1 — доля высоты кадра под окно (целевая/максимальная высота) */
  windowHeightRatio: number;
  /** 0..1 — отступ окна от верха кадра */
  windowTopMarginRatio: number;
  /** Множитель размера текста сообщений и аватарок, 1 = обычный размер */
  messageFontScale: number;
  /** Множитель отступов между сообщениями и полей карточки, 1 = обычные отступы */
  messageSpacingScale: number;
}

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  windowWidthRatio: 0.87,
  windowHeightRatio: 0.4,
  windowTopMarginRatio: 0.2,
  messageFontScale: 1,
  messageSpacingScale: 1,
};
