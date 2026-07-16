import React, { useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ChatTheme, LayoutSettings, Message } from "@cueme/shared";
import { DEFAULT_LAYOUT_SETTINGS } from "@cueme/shared";

import { getScaledBubbleMetrics, type ScaledBubbleMetrics } from "./bubbleMetrics";
import { BackgroundVideo } from "./BackgroundVideo";
import { BotBanner } from "./BotBanner";
import {
  CUEME_NOTIFICATION_PRE_PAUSE_SEC,
  CueMeNotification,
  cueMeNotificationDurationInFrames,
} from "./CueMeNotification";
import { getCardState } from "./cardHeight";
import { ChatWindowCard, getChatWindowCardLayout } from "./ChatWindowCard";
import type {
  ChatVideoProps,
  MessageTiming,
  SuggestionContent,
  SuggestionTiming,
} from "./types";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "./types";

// Размеры под кадр 1080x1920 (примерно x2.7 от браузерного превью).
// Размер/отступы сообщений настраиваются через LayoutSettings —
// см. bubbleMetrics.ts/getScaledBubbleMetrics(); здесь остаётся только
// то, что вне конструктора (боковые поля бейджа-подсказки и т.п.)
const SIDE_PADDING = 48;
const SUGGESTION_FONT_SIZE = 56;
const SUGGESTION_LOGO_HEIGHT = 140;

/** Статичное время отправки для стилизованного мок-чата (реального timestamp у Message нет) */
const MESSAGE_TIME = "9:41";

/** Двойная галочка «прочитано» Telegram — инлайн-SVG (см. тот же компонент в apps/web ChatBubble) */
const TelegramDoubleCheck: React.FC<{ color: string; size: number }> = ({
  color,
  size,
}) => (
  <svg
    width={size}
    height={(size * 11) / 16}
    viewBox="0 0 16 11"
    fill="none"
    style={{ display: "block" }}
  >
    <path
      d="M1 6.2 3.4 8.6 8.6 2.4M6.6 8 7.4 8.8 12.6 2.6"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const VideoBubble: React.FC<{
  message: Message;
  theme: ChatTheme;
  appearFrame: number;
  /** Скрываем подпись имени, если предыдущее сообщение — от того же отправителя */
  showLabel: boolean;
  /** Доп. отступ сверху — полный, если сменился отправитель, иначе почти без него */
  marginTop: number;
  metrics: ScaledBubbleMetrics;
}> = ({ message, theme, appearFrame, showLabel, marginTop, metrics }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isRight = message.side === "right";
  const bubble = isRight ? theme.bubble.right : theme.bubble.left;
  const tg = theme.telegram;
  const metaColor = tg ? (isRight ? tg.outgoingMeta : tg.incomingMeta) : "";

  const progress = spring({
    frame: frame - appearFrame,
    fps,
    config: { damping: 16, stiffness: 220, mass: 0.7 },
  });
  const opacity = interpolate(progress, [0, 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(progress, [0, 1], [36, 0]);
  const scale = interpolate(progress, [0, 1], [0.85, 1]);
  const cornerRadius = theme.bubble.borderRadius
    ? `calc(${theme.bubble.borderRadius} * 2.2)`
    : "40px";
  // «Хвостик»: у Telegram острее (меньше радиус), чем прежний общий 14px
  const tailRadius = tg ? 8 : 14;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 24,
        flexDirection: isRight ? "row-reverse" : "row",
        marginTop,
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        transformOrigin: isRight ? "bottom right" : "bottom left",
      }}
    >
      {message.avatarUrl ? (
        <Img
          src={message.avatarUrl}
          style={{
            width: metrics.avatarSize,
            height: metrics.avatarSize,
            borderRadius: "50%",
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: metrics.avatarSize,
            height: metrics.avatarSize,
            borderRadius: "50%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#9ca3af",
            color: "#ffffff",
            fontSize: metrics.labelFontSize + 6,
            fontWeight: 600,
          }}
        >
          {message.sender.charAt(0).toUpperCase() || "?"}
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: showLabel ? 6 : 0,
          maxWidth: "72%",
          alignItems: isRight ? "flex-end" : "flex-start",
        }}
      >
        {showLabel ? (
          <span
            style={{
              color: theme.senderLabel,
              fontSize: metrics.labelFontSize,
              padding: "0 8px",
            }}
          >
            {message.sender}
          </span>
        ) : null}
        <div
          style={{
            background: bubble.background,
            color: bubble.text,
            fontSize: metrics.bubbleFontSize,
            lineHeight: 1.35,
            padding: `${metrics.bubblePaddingVertical}px ${metrics.bubblePaddingHorizontal}px`,
            // Четыре отдельных угла вместо borderRadius+borderBottom*Radius —
            // React ругается на смешивание shorthand и longhand в одном style
            borderTopLeftRadius: cornerRadius,
            borderTopRightRadius: cornerRadius,
            borderBottomLeftRadius: isRight ? cornerRadius : tailRadius,
            borderBottomRightRadius: isRight ? tailRadius : cornerRadius,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            boxShadow: tg ? "0 2px 3px rgba(0,0,0,0.10)" : undefined,
          }}
        >
          {/* Telegram: время + галочки прочтения float:right (см. ChatBubble.tsx) —
              float не добавляет гарантированную лишнюю строку, поэтому оценка
              высоты карточки (cardHeight.ts) остаётся валидной */}
          {tg ? (
            <span
              style={{
                float: "right",
                display: "inline-flex",
                alignItems: "center",
                gap: metrics.bubbleFontSize * 0.14,
                marginLeft: metrics.bubbleFontSize * 0.3,
                transform: `translateY(${metrics.bubbleFontSize * 0.28}px)`,
                fontSize: metrics.bubbleFontSize * 0.6,
                color: metaColor,
              }}
            >
              {MESSAGE_TIME}
              {isRight ? (
                // галочки прочтения — синим акцентом, не цветом времени (как в референсе)
                <TelegramDoubleCheck
                  color={tg.accent}
                  size={metrics.bubbleFontSize * 0.62}
                />
              ) : null}
            </span>
          ) : null}
          {message.text}
        </div>
      </div>
    </div>
  );
};

/**
 * Логотип берётся из apps/web/public/cueme-logo.png.
 * staticFile() сама подбирает правильный путь: "/cueme-logo.png" в живом
 * превью (Next.js раздаёт public/ из корня) и "/public/cueme-logo.png"
 * внутри собранного для рендера бандла Remotion (там public/ — подпапка).
 * Обычный <img>, не Remotion <Img> — так рендер не падает, если файла ещё
 * нет, а просто показывает текстовую заглушку "CueMe".
 */
const SuggestionLogo: React.FC = () => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        style={{
          color: "#ffffff",
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: 0.5,
        }}
      >
        CueMe
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={staticFile("cueme-logo.png")}
      alt="CueMe"
      style={{ height: SUGGESTION_LOGO_HEIGHT }}
      onError={() => setFailed(true)}
    />
  );
};

/**
 * Бейдж-подсказка от CueMe: выезжает снизу после указанного сообщения
 * и плавно исчезает, не перекрывая пузыри переписки (они растут сверху вниз).
 */
const SuggestionBadge: React.FC<{
  suggestion: SuggestionContent;
  timing: SuggestionTiming;
}> = ({ suggestion, timing }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const startFrame = Math.floor(timing.startSec * fps);
  const durationFrames = Math.max(Math.ceil(timing.durationSec * fps), 1);
  const localFrame = frame - startFrame;

  if (localFrame < 0 || localFrame > durationFrames) return null;

  const fadeFrames = Math.min(12, Math.floor(durationFrames / 3));
  const opacity = interpolate(
    localFrame,
    [0, fadeFrames, durationFrames - fadeFrames, durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const scale = interpolate(localFrame, [0, fadeFrames], [0.9, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `0 ${SIDE_PADDING}px`,
        opacity,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          padding: "56px 48px",
          borderRadius: 40,
          background: "#141417",
          border: "2px solid transparent",
          backgroundImage:
            "linear-gradient(#141417, #141417), linear-gradient(120deg, #7c5cff, #ff5ca8)",
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.45)",
          maxWidth: "88%",
          transform: `scale(${scale})`,
        }}
      >
        <SuggestionLogo />
        <p
          style={{
            margin: 0,
            color: "#ffffff",
            fontSize: SUGGESTION_FONT_SIZE,
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          {suggestion.text}
        </p>
      </div>
    </div>
  );
};

export const ChatVideo: React.FC<ChatVideoProps> = ({
  messages,
  theme,
  timings,
  suggestion,
  suggestionTiming,
  background,
  headerStyle,
  layout,
  botBanner,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const messageById = new Map(messages.map((m) => [m.id, m]));

  // Шапка окна переписки показывает левого собеседника (условно — «контакт»,
  // не «я»): берём его имя/аватар из первого сообщения слева, без изменений
  // в схеме Message
  const headerMessage =
    messages.find((m) => m.side === "left") ?? messages[0];

  const resolvedHeaderStyle = headerStyle ?? "compact";
  const resolvedLayout: LayoutSettings = layout ?? DEFAULT_LAYOUT_SETTINGS;
  // Telegram — переписка 1-на-1 без подписей имён над пузырями; рендер и оценка
  // высоты карточки должны согласованно это учитывать (см. cardHeight.ts)
  const showLabels = !theme.telegram;
  const metrics = getScaledBubbleMetrics(
    resolvedLayout.messageFontScale,
    resolvedLayout.messageSpacingScale,
    resolvedLayout.windowWidthRatio
  );
  const cardLayout = getChatWindowCardLayout(
    VIDEO_WIDTH,
    VIDEO_HEIGHT,
    resolvedHeaderStyle,
    resolvedLayout
  );
  const cardState = getCardState({
    frame,
    fps,
    messages,
    timings,
    headerHeight: cardLayout.headerHeight,
    maxCardHeight: cardLayout.maxHeight,
    metrics,
    showLabels,
  });
  const cardHeight = cardState.height;
  // показываем только сообщения текущего цикла — как только новое
  // сообщение не помещается, карточка сбрасывается и список начинается заново
  const visible = timings.filter(
    (t) =>
      frame >= Math.floor(t.startSec * fps) &&
      cardState.visibleMessageIds.has(t.id)
  );

  return (
    <AbsoluteFill
      style={{
        background: theme.container.background,
        color: theme.container.text,
        fontFamily: theme.fontFamily,
      }}
    >
      {background ? <BackgroundVideo background={background} /> : null}
      <ChatWindowCard
        theme={theme}
        headerStyle={resolvedHeaderStyle}
        headerName={headerMessage?.sender ?? "Chat"}
        headerAvatarUrl={headerMessage?.avatarUrl}
        videoWidth={VIDEO_WIDTH}
        videoHeight={VIDEO_HEIGHT}
        layoutSettings={resolvedLayout}
        height={cardHeight}
        overlay={
          // Push-уведомления CueMe — "после какого сообщения" (см. Message.
          // isHintMoment/hintText, настраивается в SuggestionPanel), только
          // для темы Telegram iOS (theme.telegram). Отдаём как overlay ВНУТРЬ
          // окна чата — карточка обрезает его по своим границам (overflow),
          // поэтому баннер выезжает из-под шапки, из верха диалогового окна.
          // from считается ВПЕРЁД от конца ЭТОГО ЖЕ сообщения (t.startSec +
          // t.durationSec), не назад от следующего — специально: если бы
          // баннер мог висеть перед сообщением (в т.ч. перед первым), окно
          // чата в этот момент могло ещё не вырасти (высота = только шапка)
          // и обрезало бы баннер до нулевой видимой области. После уже
          // показанного сообщения карточка гарантированно имеет реальную
          // высоту. VideoPreview.tsx резервирует то же самое время
          // (cueMeNotificationPrecedeSec) ПОСЛЕ сообщения при расчёте
          // таймингов — эти два места не могут разъехаться.
          <>
            {theme.telegram
              ? timings.map((t: MessageTiming) => {
                  const message = messageById.get(t.id);
                  const hintText = message?.hintText?.trim();
                  if (!message?.isHintMoment || !hintText) return null;
                  const hintAudioDurationSec = t.hintAudioDurationSec;
                  const from = Math.round(
                    (t.startSec + t.durationSec + CUEME_NOTIFICATION_PRE_PAUSE_SEC) *
                      fps
                  );
                  return (
                    <Sequence
                      key={`hint-${t.id}`}
                      from={from}
                      durationInFrames={cueMeNotificationDurationInFrames(
                        fps,
                        hintText,
                        hintAudioDurationSec
                      )}
                    >
                      <CueMeNotification
                        text={hintText}
                        audioUrl={message.hintAudioUrl}
                        audioDurationSec={hintAudioDurationSec}
                      />
                    </Sequence>
                  );
                })
              : null}
          </>
        }
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            // сообщения появляются сверху окна и растут вниз, как обычный текст
            justifyContent: "flex-start",
            // базовый gap — тесный (для сообщений одного отправителя подряд),
            // при смене отправителя добавляем разницу через marginTop бабла
            gap: metrics.messageRowGapSameSender,
            width: "100%",
            height: "100%",
            padding: `${metrics.cardContentTopPadding}px ${metrics.cardContentSidePadding}px ${metrics.cardContentBottomPadding}px`,
            overflow: "hidden",
            // Telegram: «обои» под сообщениями (белые входящие пузыри иначе
            // сливались бы с белой подложкой карточки container.background)
            background: theme.telegram?.chatBackground,
          }}
        >
          {visible.map((t, index) => {
            const message = messageById.get(t.id);
            if (!message) return null;
            const previousMessage =
              index > 0 ? messageById.get(visible[index - 1].id) : null;
            const sameSenderAsPrevious =
              previousMessage?.sender === message.sender;
            return (
              <VideoBubble
                key={t.id}
                message={message}
                theme={theme}
                appearFrame={Math.floor(t.startSec * fps)}
                showLabel={showLabels && !sameSenderAsPrevious}
                marginTop={
                  index === 0 || sameSenderAsPrevious
                    ? 0
                    : metrics.messageRowGap - metrics.messageRowGapSameSender
                }
                metrics={metrics}
              />
            );
          })}
        </div>
      </ChatWindowCard>
      {timings.map((t: MessageTiming) => {
        const message = messageById.get(t.id);
        if (!message?.audioUrl) return null;
        return (
          <Sequence
            key={`audio-${t.id}`}
            from={Math.floor(t.startSec * fps)}
            durationInFrames={Math.max(Math.ceil(t.durationSec * fps), 1)}
          >
            <Audio src={message.audioUrl} />
          </Sequence>
        );
      })}
      {suggestion?.text && suggestionTiming ? (
        <SuggestionBadge suggestion={suggestion} timing={suggestionTiming} />
      ) : null}
      {suggestion?.audioUrl && suggestionTiming ? (
        <Sequence
          from={Math.floor(suggestionTiming.startSec * fps)}
          durationInFrames={Math.max(
            Math.ceil(suggestionTiming.durationSec * fps),
            1
          )}
        >
          <Audio src={suggestion.audioUrl} />
        </Sequence>
      ) : null}
      {botBanner?.enabled && botBanner.text.trim() ? (
        <BotBanner
          text={botBanner.text}
          position={botBanner.position}
          timing={botBanner.timing}
          timingDurationSec={botBanner.timingDurationSec}
          periodicIntervalSec={botBanner.periodicIntervalSec}
          periodicVisibleSec={botBanner.periodicVisibleSec}
          theme={theme}
        />
      ) : null}
    </AbsoluteFill>
  );
};
