import React, { useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ChatTheme, Message } from "@cueme/shared";

import type {
  ChatVideoProps,
  MessageTiming,
  SuggestionContent,
  SuggestionTiming,
} from "./types";

// Размеры под кадр 1080x1920 (примерно x2.7 от браузерного превью)
const BUBBLE_FONT_SIZE = 48;
const LABEL_FONT_SIZE = 32;
const AVATAR_SIZE = 92;
const SIDE_PADDING = 48;
const SUGGESTION_FONT_SIZE = 34;
const SUGGESTION_LOGO_HEIGHT = 64;

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
            borderRadius: theme.bubble.borderRadius
              ? `calc(${theme.bubble.borderRadius} * 2.2)`
              : 40,
            ...(isRight
              ? { borderBottomRightRadius: 14 }
              : { borderBottomLeftRadius: 14 }),
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
 * Логотип берётся из apps/web/public/cueme-logo.png (обычный <img>, не
 * Remotion <Img> — так рендер не падает, если файла ещё нет, а просто
 * показывает текстовую заглушку "CueMe").
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
      src="/cueme-logo.png"
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
  const translateY = interpolate(localFrame, [0, fadeFrames], [24, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: SIDE_PADDING,
        right: SIDE_PADDING,
        bottom: 96,
        display: "flex",
        justifyContent: "center",
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          padding: "28px 40px",
          borderRadius: 32,
          background: "#141417",
          border: "2px solid transparent",
          backgroundImage:
            "linear-gradient(#141417, #141417), linear-gradient(120deg, #7c5cff, #ff5ca8)",
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.45)",
          maxWidth: "82%",
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
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const messageById = new Map(messages.map((m) => [m.id, m]));
  const visible = timings.filter((t) => frame >= Math.floor(t.startSec * fps));

  return (
    <AbsoluteFill
      style={{
        background: theme.container.background,
        color: theme.container.text,
        fontFamily: theme.fontFamily,
      }}
    >
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          // сообщения появляются сверху кадра и растут вниз, как обычный текст
          justifyContent: "flex-start",
          gap: 36,
          padding: `140px ${SIDE_PADDING}px 60px`,
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
      </AbsoluteFill>
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
