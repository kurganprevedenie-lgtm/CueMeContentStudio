export type {
  Message,
  Participant,
  Suggestion,
  BackgroundSettings,
  LayoutSettings,
} from "./types";
export { DEFAULT_LAYOUT_SETTINGS } from "./types";
export { useChatStore, type ParticipantIndex } from "./store";
export {
  themes,
  defaultThemeId,
  type ChatTheme,
  type ThemeId,
} from "./themes";
