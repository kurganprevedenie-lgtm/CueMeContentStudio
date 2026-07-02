export type ThemeId = "imessage-light" | "imessage-dark" | "instagram-dm";

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
}

export const themes: Record<ThemeId, ChatTheme> = {
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

export const defaultThemeId: ThemeId = "imessage-light";
