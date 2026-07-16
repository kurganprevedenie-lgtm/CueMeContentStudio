export interface Message {
  id: string;
  sender: string;
  text: string;
  side: "left" | "right";
  avatarUrl?: string;
  /** data-URL сгенерированной озвучки (этап 3+) */
  audioUrl?: string;
  /**
   * Момент «подсказки от бота»: в этот момент видео показывает
   * push-уведомление CueMe (см. CueMeNotification в packages/remotion).
   * Привязано к конкретному сообщению, а не к произвольному кадру.
   */
  isHintMoment?: boolean;
  /** Текст подсказки для уведомления CueMe (когда isHintMoment) */
  hintText?: string;
  /** data-URL озвучки подсказки (ElevenLabs, см. SuggestionPanel) — необязательна */
  hintAudioUrl?: string;
  /** data-URL фото, прикреплённого к сообщению (необязательно, может быть с текстом или без него) */
  imageUrl?: string;
  /**
   * Реальное соотношение сторон фото (ширина/высота), измеренное при
   * загрузке (см. MessageForm.tsx) — так же, как длительность аудио всегда
   * берётся из реального файла (см. CLAUDE.md), а не оценивается: высота
   * пузыря с фото (packages/remotion/src/cardHeight.ts) должна совпадать с
   * тем, что реально нарисуется, а не гадать по среднему кадру.
   */
  imageAspectRatio?: number;
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

export type BotBannerPosition = "top" | "bottom" | "watermark";
export type BotBannerTiming = "always" | "intro" | "outro" | "periodic";

/**
 * CTA-баннер с юзернеймом Telegram-бота CueMe поверх готового видео —
 * настраивается пользователем (см. store.ts/BotBannerPanel), живёт в shared
 * по тому же принципу, что и LayoutSettings: нужен и стору (UI), и
 * Remotion-композиции (packages/remotion/src/BotBanner.tsx).
 */
export interface BotBannerSettings {
  enabled: boolean;
  /** Текст рядом с иконкой Telegram, например "@CueMeChatBot" — дефолт берётся из env, см. store.ts */
  text: string;
  position: BotBannerPosition;
  timing: BotBannerTiming;
  /** Для timing "intro"/"outro" — сколько секунд от начала/до конца виден баннер */
  timingDurationSec: number;
  /** Для timing "periodic" — раз в сколько секунд появляется */
  periodicIntervalSec: number;
  /** Для timing "periodic" — на сколько секунд появляется каждый раз */
  periodicVisibleSec: number;
}

export const DEFAULT_BOT_BANNER_SETTINGS: BotBannerSettings = {
  enabled: false,
  text: "",
  position: "watermark",
  timing: "always",
  timingDurationSec: 4,
  periodicIntervalSec: 8,
  periodicVisibleSec: 2.5,
};
