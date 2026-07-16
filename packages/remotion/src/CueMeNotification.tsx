import React, { useState } from "react";
import {
  Audio,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/** Длительность слайда вниз/вверх, сек (по одной на каждую сторону) */
export const CUEME_NOTIFICATION_SLIDE_SEC = 0.4;
/** Минимальное время удержания на экране — даже для совсем короткого текста */
export const CUEME_NOTIFICATION_MIN_HOLD_SEC = 3;
/** Скорость чтения про себя для оценки времени удержания, символов/сек */
export const CUEME_NOTIFICATION_CHARS_PER_SEC = 13;
/** Пауза после того, как уведомление полностью скрылось, и до появления сообщения */
export const CUEME_NOTIFICATION_GAP_SEC = 0.6;
/**
 * Доп. пауза ПЕРЕД тем, как уведомление начнёт появляться — даёт долистать
 * (дочитать) предыдущую реплику, прежде чем внимание переключится на баннер.
 */
export const CUEME_NOTIFICATION_PRE_PAUSE_SEC = 0.6;

/**
 * Время удержания баннера на экране (между слайдами). Если подсказка
 * озвучена (audioDurationSec — РЕАЛЬНАЯ длительность файла, не оценка,
 * см. VideoPreview.tsx/getAudioDurationInSeconds) — держим ровно на неё,
 * с тем же минимумом. Иначе — грубая оценка по длине текста, чтобы подсказка
 * успевала прочитаться, а не висела фиксированное время независимо от длины.
 */
export function estimateHintHoldSec(
  text: string,
  audioDurationSec?: number
): number {
  if (audioDurationSec) {
    return Math.max(CUEME_NOTIFICATION_MIN_HOLD_SEC, audioDurationSec);
  }
  return Math.max(
    CUEME_NOTIFICATION_MIN_HOLD_SEC,
    text.trim().length / CUEME_NOTIFICATION_CHARS_PER_SEC
  );
}

/** Полная длительность жизни уведомления, сек: слайд-вниз + удержание + слайд-вверх */
export function cueMeNotificationDurationSec(
  text: string,
  audioDurationSec?: number
): number {
  return (
    CUEME_NOTIFICATION_SLIDE_SEC * 2 + estimateHintHoldSec(text, audioDurationSec)
  );
}

/**
 * То же самое в кадрах — ChatVideo задаёт этим durationInFrames у <Sequence>,
 * чтобы уведомление существовало ровно своё окно.
 */
export function cueMeNotificationDurationInFrames(
  fps: number,
  text: string,
  audioDurationSec?: number
): number {
  return Math.ceil(cueMeNotificationDurationSec(text, audioDurationSec) * fps);
}

/**
 * Сколько секунд ДО startSec сообщения должен начаться сам Sequence
 * уведомления (`from` в ChatVideo) — длительность баннера + пауза после его
 * скрытия. НЕ включает CUEME_NOTIFICATION_PRE_PAUSE_SEC — та пауза лежит
 * ДО начала этого Sequence (время дочитать предыдущую реплику), в кадре в
 * этот момент баннер ещё не показывается вообще.
 */
export function cueMeNotificationLeadSec(
  text: string,
  audioDurationSec?: number
): number {
  return (
    cueMeNotificationDurationSec(text, audioDurationSec) + CUEME_NOTIFICATION_GAP_SEC
  );
}

/**
 * Сколько секунд нужно зарезервировать ПЕРЕД сообщением целиком (для
 * подсчёта таймингов в apps/web VideoPreview.tsx): пауза-дочитка предыдущей
 * реплики (CUEME_NOTIFICATION_PRE_PAUSE_SEC) + весь lead уведомления
 * (появиться/повисеть/скрыться + пауза после скрытия). Сообщение не должно
 * всплывать поверх ещё не скрывшегося баннера, а баннер не должен начинать
 * появляться, пока не дочиталась предыдущая реплика.
 */
export function cueMeNotificationPrecedeSec(
  text: string,
  audioDurationSec?: number
): number {
  return (
    CUEME_NOTIFICATION_PRE_PAUSE_SEC + cueMeNotificationLeadSec(text, audioDurationSec)
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
  /** data-URL озвучки подсказки (ElevenLabs, см. SuggestionPanel) — необязательна */
  audioUrl?: string;
  /**
   * РЕАЛЬНАЯ длительность audioUrl (getAudioDurationInSeconds в
   * VideoPreview.tsx, не оценка) — если задана, время удержания баннера
   * подстраивается под неё вместо оценки по длине текста.
   */
  audioDurationSec?: number;
  /** Слегка притемнить кадр под баннером, пока он виден. По умолчанию false */
  dimChatBehind?: boolean;
}

/**
 * Имитация iOS push-уведомления от Telegram-бота CueMe: скруглённый баннер с
 * полупрозрачной «матовой» подложкой (backdrop-blur в кадре Remotion
 * ненадёжен, поэтому имитируем высокой полупрозрачностью светлой заливки),
 * иконкой бота, заголовком «CueMe · сейчас» и текстом подсказки, плюс
 * системный звук уведомления iPhone в момент появления.
 *
 * Позиционируется ОТНОСИТЕЛЬНО родителя (ChatVideo кладёт его в overlay
 * ChatWindowCard — слой поверх области сообщений, обрезанный границами окна).
 * Поэтому баннер выезжает из верха диалогового окна, из-под шапки (скрытая
 * позиция уходит вверх за границу окна и обрезается overflow карточки), а не
 * из верха всего кадра. Рассчитан на размещение внутри <Sequence from=...>:
 * локальный useCurrentFrame идёт от 0, анимация строится от него. Время
 * удержания считается через estimateHintHoldSec(text, audioDurationSec) —
 * та же функция (и то же audioDurationSec), которым VideoPreview.tsx
 * резервирует место ПЕРЕД сообщением (cueMeNotificationPrecedeSec), иначе
 * длительность баннера и тайминг сообщения могли бы разъехаться.
 */
export const CueMeNotification: React.FC<CueMeNotificationProps> = ({
  text,
  audioUrl,
  audioDurationSec,
  dimChatBehind = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const holdDurationSec = estimateHintHoldSec(text, audioDurationSec);
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
      {/* Звук уведомления iPhone — играет один раз в момент появления баннера.
          Файл нужно положить самостоятельно: apps/web/public/sounds/ios-notification.mp3
          (лицензионный звук Apple нельзя распространять в этом репозитории —
          используй свой короткий "дзинь"/поставь реальный экспортированный
          с iPhone). Если файла нет — Player тихо не проиграет звук, а
          серверный рендер (@remotion/renderer) может упасть с ошибкой
          отсутствующего ассета, так что перед экспортом видео файл обязателен. */}
      <Audio src={staticFile("sounds/ios-notification.mp3")} />
      {/* Озвучка подсказки (ElevenLabs, см. SuggestionPanel) — стартует
          после того, как баннер долетел до состояния покоя, чтобы не спорить
          со звуком уведомления. */}
      {audioUrl ? (
        <Sequence from={slideFrames}>
          <Audio src={audioUrl} />
        </Sequence>
      ) : null}
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
          gap: 24,
          padding: "28px 30px",
          borderRadius: 38,
          // «матовая» светлая подложка — имитация frosted-glass без backdrop-filter
          background: "rgba(245, 245, 247, 0.92)",
          boxShadow: "0 14px 40px rgba(0, 0, 0, 0.26)",
          fontFamily: IOS_FONT,
        }}
      >
        <NotificationBotIcon size={78} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 36, fontWeight: 700, color: "#111114" }}>
              CueMe
            </span>
            <span style={{ fontSize: 28, color: "#8a8a8e", flexShrink: 0 }}>
              сейчас
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 36,
              lineHeight: 1.32,
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
