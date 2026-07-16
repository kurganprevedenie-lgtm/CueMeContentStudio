import type {
  BotBannerSettings,
  ChatTheme,
  LayoutSettings,
  Message,
} from "@cueme/shared";

import type { ChatHeaderStyle } from "./ChatWindowCard";
import { cueMeNotificationPrecedeSec } from "./CueMeNotification";

/**
 * Тайминг одного сообщения в видео.
 * durationSec считается из реальной длительности аудиофайла
 * (getAudioDurationInSeconds), не из длины текста.
 */
export interface MessageTiming {
  /** id сообщения из Message */
  id: string;
  /** Секунда, на которой сообщение появляется */
  startSec: number;
  /** Сколько секунд сообщение «звучит» (длительность аудио или пауза по умолчанию) */
  durationSec: number;
  /**
   * РЕАЛЬНАЯ длительность озвучки подсказки CueMe (Message.hintAudioUrl),
   * если она озвучена — из getAudioDurationInSeconds, не оценка по тексту.
   * Используется CueMeNotification/cueMeNotificationPrecedeSec, чтобы баннер
   * держался ровно на время озвучки.
   */
  hintAudioDurationSec?: number;
}

/** Когда на видео показывать бейдж-подсказку от CueMe и сколько секунд он виден */
export interface SuggestionTiming {
  startSec: number;
  durationSec: number;
}

/** Текст (и, если озвучен, аудио) подсказки-бейджа */
export interface SuggestionContent {
  text: string;
  audioUrl?: string;
}

/**
 * Фоновое видео (gameplay-заливка) позади переписки.
 * durationInFrames — реальная длительность одного цикла файла (из
 * @remotion/media-parser, не оценка), нужна для зацикливания через <Loop>.
 * Тайминг фона независим от таймингов сообщений/подсказки.
 */
export interface BackgroundVideoContent {
  url: string;
  /**
   * Длительность одного цикла зацикливания в кадрах. Если задан trim —
   * это длительность именно выбранного фрагмента, не всего файла.
   */
  durationInFrames: number;
  /** 0..1 */
  volume: number;
  /** 0..1 — затемнение поверх видео для читаемости пузырей */
  overlayOpacity: number;
  /**
   * Смещение точки старта внутри файла, в кадрах (проп trimBefore у
   * OffthreadVideo; в Remotion 4 startFrom переименован в trimBefore).
   * Не задан — видео с самого начала.
   */
  trimBeforeFrames?: number;
}

/**
 * Props композиции ChatVideo.
 * ВНИМАНИЕ: контракт рендера — менять только по согласованию (см. ARCHITECTURE.md).
 * Объявлено через type (не interface) — Remotion требует совместимости
 * с Record<string, unknown>.
 */
export type ChatVideoProps = {
  messages: Message[];
  theme: ChatTheme;
  timings: MessageTiming[];
  suggestion?: SuggestionContent | null;
  suggestionTiming?: SuggestionTiming | null;
  background?: BackgroundVideoContent | null;
  /** Стиль шапки окна переписки, по умолчанию "compact" (карточка небольшая) */
  headerStyle?: ChatHeaderStyle;
  /** Настраиваемые размер/отступы окна и сообщений — не задано = DEFAULT_LAYOUT_SETTINGS */
  layout?: LayoutSettings | null;
  /** CTA-баннер с юзернеймом Telegram-бота поверх готового кадра — не задано/enabled: false = баннера нет */
  botBanner?: BotBannerSettings | null;
};

export const VIDEO_FPS = 30;
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;

/** Хвост тишины в конце ролика, сек */
const TAIL_SEC = 1;

/**
 * messages — опционален по обратной совместимости, но нужен, чтобы учесть
 * "хвост" уведомления CueMe (см. CueMeNotification), если оно висит ПОСЛЕ
 * последнего сообщения диалога: сама подсказка длится уже за пределами
 * startSec+durationSec своего сообщения, и без этого видео обрезалось бы,
 * пока баннер ещё доигрывает. Для подсказки на любом НЕ последнем сообщении
 * это не нужно — её время уже "впитано" в startSec следующего сообщения
 * (см. VideoPreview.tsx), но проверяем все на всякий случай, не только
 * последнее — дешёво, а порядок timings совпадать с messages не обязан.
 */
export function totalDurationInFrames(
  timings: MessageTiming[],
  suggestionTiming?: SuggestionTiming | null,
  messages?: Message[]
): number {
  let lastEnd = timings.reduce(
    (max, t) => Math.max(max, t.startSec + t.durationSec),
    0
  );
  if (suggestionTiming) {
    lastEnd = Math.max(
      lastEnd,
      suggestionTiming.startSec + suggestionTiming.durationSec
    );
  }
  if (messages) {
    const messageById = new Map(messages.map((m) => [m.id, m]));
    for (const t of timings) {
      const message = messageById.get(t.id);
      const hintText = message?.hintText?.trim();
      if (!message?.isHintMoment || !hintText) continue;
      const hintEnd =
        t.startSec +
        t.durationSec +
        cueMeNotificationPrecedeSec(hintText, t.hintAudioDurationSec);
      lastEnd = Math.max(lastEnd, hintEnd);
    }
  }
  return Math.max(Math.ceil((lastEnd + TAIL_SEC) * VIDEO_FPS), VIDEO_FPS * 2);
}
