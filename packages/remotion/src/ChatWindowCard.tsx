import React from "react";
import type { ChatTheme } from "@cueme/shared";

export type ChatHeaderStyle = "profile" | "compact";

// Геометрия окна переписки: небольшая карточка в верхней части кадра,
// а не на весь экран — снизу и по бокам должно быть видно BackgroundVideo.
const CARD_WIDTH_RATIO = 0.87; // 87% ширины кадра (в требуемых 85–90%)
const CARD_HEIGHT_RATIO = 0.4; // 40% высоты кадра (в требуемых 35–45%)
const CARD_TOP_MARGIN = 64; // отступ от самого верха кадра
const CARD_BORDER_RADIUS = 44;

const HEADER_HEIGHT_COMPACT = 84;
const HEADER_HEIGHT_PROFILE = 156;

export interface ChatWindowCardLayout {
  width: number;
  height: number;
  left: number;
  top: number;
  borderRadius: number;
  headerHeight: number;
  /** Высота области сообщений внутри карточки (карточка минус шапка) */
  contentHeight: number;
}

/** Пересчитывает геометрию карточки под размер кадра композиции */
export function getChatWindowCardLayout(
  videoWidth: number,
  videoHeight: number,
  headerStyle: ChatHeaderStyle
): ChatWindowCardLayout {
  const width = Math.round(videoWidth * CARD_WIDTH_RATIO);
  const height = Math.round(videoHeight * CARD_HEIGHT_RATIO);
  const headerHeight =
    headerStyle === "profile" ? HEADER_HEIGHT_PROFILE : HEADER_HEIGHT_COMPACT;
  return {
    width,
    height,
    left: Math.round((videoWidth - width) / 2),
    top: CARD_TOP_MARGIN,
    borderRadius: CARD_BORDER_RADIUS,
    headerHeight,
    contentHeight: height - headerHeight,
  };
}

const ChatHeader: React.FC<{
  headerStyle: ChatHeaderStyle;
  name: string;
  avatarUrl?: string;
  theme: ChatTheme;
  height: number;
}> = ({ headerStyle, name, avatarUrl, theme, height }) => {
  const avatarSize = headerStyle === "profile" ? 64 : 44;

  const avatar = (
    <div
      style={{
        width: avatarSize,
        height: avatarSize,
        borderRadius: "50%",
        flexShrink: 0,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#9ca3af",
        color: "#ffffff",
        fontWeight: 600,
        fontSize: avatarSize / 2,
      }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        name.charAt(0).toUpperCase() || "?"
      )}
    </div>
  );

  if (headerStyle === "profile") {
    return (
      <div
        style={{
          height,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          borderBottom: `1px solid ${theme.senderLabel}33`,
        }}
      >
        {avatar}
        <span
          style={{ color: theme.container.text, fontSize: 24, fontWeight: 600 }}
        >
          {name}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        height,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 24px",
        borderBottom: `1px solid ${theme.senderLabel}33`,
      }}
    >
      {avatar}
      <span
        style={{ color: theme.container.text, fontSize: 26, fontWeight: 600 }}
      >
        {name}
      </span>
    </div>
  );
};

/**
 * Небольшое окно переписки в верхней части кадра — не на весь экран.
 * Снизу и по бокам остаётся видно BackgroundVideo (см. ChatVideo.tsx).
 */
export const ChatWindowCard: React.FC<{
  theme: ChatTheme;
  headerStyle: ChatHeaderStyle;
  headerName: string;
  headerAvatarUrl?: string;
  videoWidth: number;
  videoHeight: number;
  children: React.ReactNode;
}> = ({
  theme,
  headerStyle,
  headerName,
  headerAvatarUrl,
  videoWidth,
  videoHeight,
  children,
}) => {
  const layout = getChatWindowCardLayout(videoWidth, videoHeight, headerStyle);

  return (
    <div
      style={{
        position: "absolute",
        top: layout.top,
        left: layout.left,
        width: layout.width,
        height: layout.height,
        borderRadius: layout.borderRadius,
        overflow: "hidden",
        background: theme.container.background,
        boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <ChatHeader
        headerStyle={headerStyle}
        name={headerName}
        avatarUrl={headerAvatarUrl}
        theme={theme}
        height={layout.headerHeight}
      />
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
};
