export { ChatVideo } from "./ChatVideo";
export { RemotionRoot } from "./Root";
export { BackgroundVideo } from "./BackgroundVideo";
export { BotBanner, type BotBannerProps } from "./BotBanner";
export {
  CueMeNotification,
  CUEME_NOTIFICATION_PRE_PAUSE_SEC,
  cueMeNotificationDurationInFrames,
  cueMeNotificationDurationSec,
  cueMeNotificationLeadSec,
  cueMeNotificationPrecedeSec,
  estimateHintHoldSec,
  type CueMeNotificationProps,
} from "./CueMeNotification";
export {
  ChatWindowCard,
  getChatWindowCardLayout,
  type ChatHeaderStyle,
} from "./ChatWindowCard";
export {
  getScaledBubbleMetrics,
  getImageDisplaySize,
  type ScaledBubbleMetrics,
} from "./bubbleMetrics";
export {
  VIDEO_FPS,
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
  totalDurationInFrames,
  type ChatVideoProps,
  type MessageTiming,
  type SuggestionTiming,
  type SuggestionContent,
  type BackgroundVideoContent,
} from "./types";
