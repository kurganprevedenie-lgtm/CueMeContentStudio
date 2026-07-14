import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { BotBannerPosition, BotBannerTiming, ChatTheme } from "@cueme/shared";

export interface BotBannerProps {
  text: string;
  position: BotBannerPosition;
  timing: BotBannerTiming;
  /** Для timing "intro"/"outro" — сколько секунд от начала/до конца виден баннер */
  timingDurationSec: number;
  /** Для timing "periodic" — раз в сколько секунд появляется */
  periodicIntervalSec: number;
  /** Для timing "periodic" — на сколько секунд появляется каждый раз */
  periodicVisibleSec: number;
  theme: ChatTheme;
}

const FADE_SEC = 0.4;
/** Непрозрачность текста/иконки в watermark — минимально навязчивый вариант */
const WATERMARK_OPACITY = 0.65;
const TELEGRAM_BLUE = "#2AABEE";

const TelegramIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={TELEGRAM_BLUE}
    style={{ flexShrink: 0 }}
  >
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.568 8.16-1.61 7.59c-.121.539-.44.672-.89.419l-2.46-1.814-1.187 1.142c-.131.131-.241.241-.494.241l.177-2.507 4.56-4.122c.198-.176-.043-.274-.307-.098l-5.639 3.552-2.428-.759c-.528-.165-.538-.528.11-.782l9.489-3.657c.44-.16.825.098.68.795z" />
  </svg>
);

/**
 * frame → множитель непрозрачности 0..1 по выбранному timing:
 * "always" — всегда виден; "intro"/"outro" — окно в timingDurationSec секунд
 * от начала/до конца ролика с плавным fade на границе; "periodic" —
 * короткие повторяющиеся появления раз в periodicIntervalSec секунд.
 * durationInFrames берём из useVideoConfig() — доступен в любом месте
 * дерева композиции, отдельно прокидывать длительность ролика не нужно.
 */
function useTimingOpacity(
  timing: BotBannerTiming,
  timingDurationSec: number,
  periodicIntervalSec: number,
  periodicVisibleSec: number
): number {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const fadeFrames = Math.round(FADE_SEC * fps);

  if (timing === "always") return 1;

  if (timing === "intro") {
    const windowFrames = Math.round(timingDurationSec * fps);
    if (frame > windowFrames) return 0;
    return interpolate(
      frame,
      [Math.max(windowFrames - fadeFrames, 0), windowFrames],
      [1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
  }

  if (timing === "outro") {
    const windowFrames = Math.round(timingDurationSec * fps);
    const startFrame = Math.max(durationInFrames - windowFrames, 0);
    if (frame < startFrame) return 0;
    return interpolate(
      frame,
      [startFrame, Math.min(startFrame + fadeFrames, durationInFrames)],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
  }

  // periodic
  const intervalFrames = Math.max(Math.round(periodicIntervalSec * fps), 1);
  const visibleFrames = Math.max(Math.round(periodicVisibleSec * fps), 1);
  const localFrame = frame % intervalFrames;
  if (localFrame > visibleFrames) return 0;
  const fade = Math.min(fadeFrames, Math.floor(visibleFrames / 3));
  return interpolate(
    localFrame,
    [0, fade, visibleFrames - fade, visibleFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
}

/**
 * CTA-баннер с юзернеймом Telegram-бота поверх готового кадра. Намеренно не
 * зависит от ChatWindowCard/BackgroundVideo (их не трогаем) — рисуется
 * отдельным слоем поверх всего остального. Текст/иконка — всегда на тёмной
 * полупрозрачной подложке (contrast overlay), цвет текста не берём из темы:
 * ChatTheme.container/bubble подобраны для читаемости внутри окна переписки,
 * а баннер должен быть читаем поверх произвольного фонового видео/любой темы,
 * так что берём из темы только fontFamily, а не цвета.
 *
 * Позиция "bottom" ставится у самого нижнего края кадра (не завязана на
 * реальную высоту ChatWindowCard, которая зависит от LayoutSettings и числа
 * сообщений) — при дефолтных/типичных настройках окна снизу всегда остаётся
 * свободная зона фона.
 */
export const BotBanner: React.FC<BotBannerProps> = ({
  text,
  position,
  timing,
  timingDurationSec,
  periodicIntervalSec,
  periodicVisibleSec,
  theme,
}) => {
  const timingOpacity = useTimingOpacity(
    timing,
    timingDurationSec,
    periodicIntervalSec,
    periodicVisibleSec
  );

  if (timingOpacity <= 0) return null;

  const baseOpacity = position === "watermark" ? WATERMARK_OPACITY : 1;
  const opacity = timingOpacity * baseOpacity;

  if (position === "watermark") {
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            right: 40,
            bottom: 40,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 20px",
            borderRadius: 999,
            background: "rgba(0, 0, 0, 0.55)",
            opacity,
          }}
        >
          <TelegramIcon size={28} />
          <span
            style={{
              fontFamily: theme.fontFamily,
              fontSize: 28,
              fontWeight: 600,
              color: "#ffffff",
              whiteSpace: "nowrap",
            }}
          >
            {text}
          </span>
        </div>
      </AbsoluteFill>
    );
  }

  const isTop = position === "top";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: isTop ? 0 : undefined,
          bottom: isTop ? undefined : 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: "28px 0",
          background: "rgba(0, 0, 0, 0.6)",
          opacity,
        }}
      >
        <TelegramIcon size={44} />
        <span
          style={{
            fontFamily: theme.fontFamily,
            fontSize: 44,
            fontWeight: 600,
            color: "#ffffff",
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
