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
import type { ChatTheme, Message } from "@cueme/shared";

import { BackgroundVideo } from "./BackgroundVideo";
import { ChatWindowCard } from "./ChatWindowCard";
import type {
  ChatVideoProps,
  MessageTiming,
  SuggestionContent,
  SuggestionTiming,
} from "./types";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "./types";

// Размеры под кадр 1080x1920 (примерно x2.7 от браузерного превью)
const BUBBLE_FONT_SIZE = 48;
const LABEL_FONT_SIZE = 32;
const AVATAR_SIZE = 92;
const SIDE_PADDING = 48;
const SUGGESTION_FONT_SIZE = 56;
const SUGGESTION_LOGO_HEIGHT = 140;

// Внутренние отступы области сообщений внутри окна переписки (карточка
// заметно уже полного кадра, поэтому поля меньше, чем раньше)
const CARD_CONTENT_SIDE_PADDING = 28;
const CARD_CONTENT_TOP_PADDING = 20;
const CARD_CONTENT_BOTTOM_PADDING = 24;

const VideoBubble: React.FC<{
  message: Message;
  theme: ChatTheme;
  appearFrame: number;
}> = ({ message, theme, appearFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isRight = message.side === "right";
  const bubble = isRight ? theme.bubble.right : theme.bubble.left;

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

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 24,
        flexDirection: isRight ? "row-reverse" : "row",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        transformOrigin: isRight ? "bottom right" : "bottom left",
      }}
    >
      {message.avatarUrl ? (
        <Img
          src={message.avatarUrl}
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: "50%",
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: "50%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#9ca3af",
            color: "#ffffff",
            fontSize: LABEL_FONT_SIZE + 6,
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
          gap: 6,
          maxWidth: "72%",
          alignItems: isRight ? "flex-end" : "flex-start",
        }}
      >
        <span
          style={{
            color: theme.senderLabel,
            fontSize: LABEL_FONT_SIZE,
            padding: "0 8px",
          }}
        >
          {message.sender}
        </span>
        <div
          style={{
            background: bubble.background,
            color: bubble.text,
            fontSize: BUBBLE_FONT_SIZE,
            lineHeight: 1.35,
            padding: "26px 38px",
            // Четыре отдельных угла вместо borderRadius+borderBottom*Radius —
            // React ругается на смешивание shorthand и longhand в одном style
            borderTopLeftRadius: cornerRadius,
            borderTopRightRadius: cornerRadius,
            borderBottomLeftRadius: isRight ? cornerRadius : 14,
            borderBottomRightRadius: isRight ? 14 : cornerRadius,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
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
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const messageById = new Map(messages.map((m) => [m.id, m]));
  const visible = timings.filter((t) => frame >= Math.floor(t.startSec * fps));

  // Шапка окна переписки показывает левого собеседника (условно — «контакт»,
  // не «я»): берём его имя/аватар из первого сообщения слева, без изменений
  // в схеме Message
  const headerMessage =
    messages.find((m) => m.side === "left") ?? messages[0];

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
        headerStyle={headerStyle ?? "compact"}
        headerName={headerMessage?.sender ?? "Chat"}
        headerAvatarUrl={headerMessage?.avatarUrl}
        videoWidth={VIDEO_WIDTH}
        videoHeight={VIDEO_HEIGHT}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            // сообщения появляются сверху окна и растут вниз, как обычный текст
            justifyContent: "flex-start",
            gap: 24,
            width: "100%",
            height: "100%",
            padding: `${CARD_CONTENT_TOP_PADDING}px ${CARD_CONTENT_SIDE_PADDING}px ${CARD_CONTENT_BOTTOM_PADDING}px`,
            overflow: "hidden",
          }}
        >
          {visible.map((t) => {
            const message = messageById.get(t.id);
            if (!message) return null;
            return (
              <VideoBubble
                key={t.id}
                message={message}
                theme={theme}
                appearFrame={Math.floor(t.startSec * fps)}
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
    </AbsoluteFill>
  );
};
