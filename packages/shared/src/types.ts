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
