import React, { useState } from "react";
import {
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/** Длительность слайда вниз/вверх, сек (по одной на каждую сторону) */
export const CUEME_NOTIFICATION_SLIDE_SEC = 0.4;
/** Сколько баннер держится на экране между слайдами, если не задано пропсом */
export const CUEME_NOTIFICATION_DEFAULT_HOLD_SEC = 2.5;

/**
 * Полная длительность жизни уведомления в кадрах (слайд-вниз + удержание +
 * слайд-вверх) — ChatVideo задаёт этим durationInFrames у <Sequence>, чтобы
 * уведомление существовало ровно своё окно.
 */
export function cueMeNotificationDurationInFrames(
  fps: number,
  holdDurationSec: number = CUEME_NOTIFICATION_DEFAULT_HOLD_SEC
): number {
  return Math.ceil(
    (CUEME_NOTIFICATION_SLIDE_SEC * 2 + holdDurationSec) * fps
  );
}

const IOS_FONT =
  '-apple-system, "SF Pro Text", BlinkMacSystemFont, "Segoe UI", sans-serif';

/**
 * Иконка бота в уведомлении: логотип из apps/web/public/cueme-logo.png, тот же
 * приём, что у SuggestionLogo в ChatVideo — обычный <img> с текстовой
 * заглушкой на случай отсутствия файла (рендер не должен падать из-за ассета).
 */
const NotificationBotIcon: React.FC<{ size: number }> = ({ size }) => {
  const [failed, setFailed] = useState(false);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 16,
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #7c5cff, #ff5ca8)",
        color: "#ffffff",
        fontWeight: 700,
        fontSize: size * 0.4,
      }}
    >
      {failed ? (
        "C"
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={staticFile("cueme-logo.png")}
          alt="CueMe"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};

export interface CueMeNotificationProps {
  /** Текст подсказки (тело уведомления) */
  text: string;
  /** Сколько секунд баннер держится на экране между слайдами. По умолчанию 2.5 */
  holdDurationSec?: number;
  /** Слегка притемнить кадр под баннером, пока он виден. По умолчанию false */
  dimChatBehind?: boolean;
}

/**
 * Имитация iOS push-уведомления от Telegram-бота CueMe: скруглённый баннер с
 * полупрозрачной «матовой» подложкой (backdrop-blur в кадре Remotion
 * ненадёжен, поэтому имитируем высокой полупрозрачностью светлой заливки),
 * иконкой бота, заголовком «CueMe · сейчас» и текстом подсказки.
 *
 * Позиционируется ОТНОСИТЕЛЬНО родителя (ChatVideo кладёт его в overlay
 * ChatWindowCard — слой поверх области сообщений, обрезанный границами окна).
 * Поэтому баннер выезжает из верха диалогового окна, из-под шапки (скрытая
 * позиция уходит вверх за границу окна и обрезается overflow карточки), а не
 * из верха всего кадра. Рассчитан на размещение внутри <Sequence from=...>:
 * локальный useCurrentFrame идёт от 0, анимация строится от него.
 */
export const CueMeNotification: React.FC<CueMeNotificationProps> = ({
  text,
  holdDurationSec = CUEME_NOTIFICATION_DEFAULT_HOLD_SEC,
  dimChatBehind = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideFrames = CUEME_NOTIFICATION_SLIDE_SEC * fps;
  const holdFrames = holdDurationSec * fps;
  const total = slideFrames * 2 + holdFrames;

  // покой — у самого верха окна чата, под шапкой; скрытая позиция уходит выше
  // границы окна и обрезается overflow карточки (см. ChatWindowCard.overlay)
  const restY = 14;
  const hiddenY = -320;

  const translateY = interpolate(
    frame,
    [0, slideFrames, slideFrames + holdFrames, total],
    [hiddenY, restY, restY, hiddenY],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    }
  );

  // притемнение области сообщений под баннером — плавно вместе со слайдами
  const dimOpacity = dimChatBehind
    ? interpolate(
        frame,
        [0, slideFrames, slideFrames + holdFrames, total],
        [0, 0.28, 0.28, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 0;

  return (
    <>
      {dimChatBehind ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#000000",
            opacity: dimOpacity,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 16,
          right: 16,
          transform: `translateY(${translateY}px)`,
          display: "flex",
          alignItems: "flex-start",
          gap: 22,
          padding: "24px 28px",
          borderRadius: 36,
          // «матовая» светлая подложка — имитация frosted-glass без backdrop-filter
          background: "rgba(245, 245, 247, 0.92)",
          boxShadow: "0 14px 40px rgba(0, 0, 0, 0.26)",
          fontFamily: IOS_FONT,
        }}
      >
        <NotificationBotIcon size={72} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 30, fontWeight: 700, color: "#111114" }}>
              CueMe
            </span>
            <span style={{ fontSize: 24, color: "#8a8a8e", flexShrink: 0 }}>
              сейчас
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 27,
              lineHeight: 1.3,
              color: "#1c1c1e",
              // не больше ~3 строк, чтобы баннер не разрастался
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {text}
          </p>
        </div>
      </div>
    </>
  );
};
