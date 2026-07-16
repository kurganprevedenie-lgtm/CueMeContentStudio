export type ThemeId =
  | "imessage-light"
  | "imessage-dark"
  | "instagram-dm"
  | "telegram-ios";

export interface ChatTheme {
  id: ThemeId;
  name: string;
  fontFamily: string;
  container: {
    /** CSS background: цвет или градиент */
    background: string;
    text: string;
  };
  /** Цвет подписи с именем отправителя */
  senderLabel: string;
  bubble: {
    borderRadius: string;
    left: { background: string; text: string };
    right: { background: string; text: string };
  };
  /**
   * Доп. оформление в стиле Telegram iOS — не задано (iMessage/Instagram) =
   * прежнее поведение. Задано = telegram-шапка (аватар/имя/статус/иконки),
   * фон-«обои» области сообщений, время + галочки прочтения внутри пузыря.
   * Читается в ChatBubble/VideoBubble/ChatWindowCard/ChatContainer — не
   * отдельная архитектура, а ветка внутри существующих компонентов.
   */
  telegram?: {
    /** Статус контакта под именем в шапке, например "в сети" */
    headerStatus: string;
    /** Фон («обои») области сообщений — сплошной цвет или градиент */
    chatBackground: string;
    /** Цвет иконок звонка/меню и акцентов в шапке */
    accent: string;
    /** Цвет времени внутри входящего пузыря */
    incomingMeta: string;
    /** Цвет времени + галочек прочтения внутри исходящего пузыря */
    outgoingMeta: string;
  };
}

export const themes: Record<ThemeId, ChatTheme> = {
  "telegram-ios": {
    id: "telegram-ios",
    name: "Telegram iOS",
    fontFamily:
      '-apple-system, "SF Pro Text", BlinkMacSystemFont, "Segoe UI", sans-serif',
    // container.background — шапка/подложка карточки (белая), сами сообщения
    // рисуются поверх telegram.chatBackground (см. ChatVideo/ChatContainer)
    container: { background: "#ffffff", text: "#000000" },
    senderLabel: "#3aa0e0",
    bubble: {
      // заметно круглее iMessage
      borderRadius: "20px",
      // входящие — белые, исходящие — бледно-зелёные с ТЁМНЫМ текстом (как в
      // Telegram iOS light из референса, НЕ синие)
      left: { background: "#ffffff", text: "#000000" },
      right: { background: "#effdde", text: "#000000" },
    },
    telegram: {
      headerStatus: "был(а) недавно",
      // мятно-зелёные «обои» Telegram (сплошной цвет — паттерн-дудлы опущены)
      chatBackground: "#d2ecd0",
      // синий акцент: кнопка «Назад» в шапке и галочки прочтения ✓✓
      accent: "#3aa0e0",
      incomingMeta: "#9aa79a",
      outgoingMeta: "#67a860",
    },
  },
  "imessage-light": {
    id: "imessage-light",
    name: "iMessage — светлая",
    fontFamily:
      '-apple-system, "SF Pro Text", BlinkMacSystemFont, "Segoe UI", sans-serif',
    container: { background: "#ffffff", text: "#000000" },
    senderLabel: "#8e8e93",
    bubble: {
      borderRadius: "18px",
      left: { background: "#e9e9eb", text: "#000000" },
      right: { background: "#007aff", text: "#ffffff" },
    },
  },
  "imessage-dark": {
    id: "imessage-dark",
    name: "iMessage — тёмная",
    fontFamily:
      '-apple-system, "SF Pro Text", BlinkMacSystemFont, "Segoe UI", sans-serif',
    container: { background: "#000000", text: "#ffffff" },
    senderLabel: "#8e8e93",
    bubble: {
      borderRadius: "18px",
      left: { background: "#26252a", text: "#ffffff" },
      right: { background: "#0a84ff", text: "#ffffff" },
    },
  },
  "instagram-dm": {
    id: "instagram-dm",
    name: "Instagram DM",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    container: { background: "#ffffff", text: "#000000" },
    senderLabel: "#737373",
    bubble: {
      borderRadius: "22px",
      left: { background: "#efefef", text: "#000000" },
      right: {
        background: "linear-gradient(135deg, #4f5bd5 0%, #962fbf 60%, #d62976 100%)",
        text: "#ffffff",
      },
    },
  },
};

export const defaultThemeId: ThemeId = "telegram-ios";
