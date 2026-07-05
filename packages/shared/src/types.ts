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
