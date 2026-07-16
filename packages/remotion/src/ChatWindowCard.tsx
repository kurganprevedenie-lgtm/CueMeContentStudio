import React from "react";
import type { ChatTheme, LayoutSettings } from "@cueme/shared";

export type ChatHeaderStyle = "profile" | "compact";

// Геометрия окна переписки: небольшая карточка в верхней части кадра,
// а не на весь экран — снизу и по бокам должно быть видно BackgroundVideo.
// Доли ширины/высоты/отступа сверху настраиваются пользователем через
// LayoutSettings (см. getChatWindowCardLayout) — здесь остаётся только то,
// что НЕ вынесено в конструктор.
const CARD_BORDER_RADIUS = 44;

const HEADER_HEIGHT_COMPACT = 84;
const HEADER_HEIGHT_PROFILE = 156;

export interface ChatWindowCardLayout {
  width: number;
  /** Целевая (максимальная) высота карточки — дальше она не растёт */
  maxHeight: number;
  left: number;
  top: number;
  borderRadius: number;
  headerHeight: number;
  /** Максимальная высота области сообщений (карточка минус шапка) */
  maxContentHeight: number;
}

/** Пересчитывает геометрию карточки под размер кадра композиции и настройки пользователя */
export function getChatWindowCardLayout(
  videoWidth: number,
  videoHeight: number,
  headerStyle: ChatHeaderStyle,
  layout: LayoutSettings
): ChatWindowCardLayout {
  const width = Math.round(videoWidth * layout.windowWidthRatio);
  const maxHeight = Math.round(videoHeight * layout.windowHeightRatio);
  const headerHeight =
    headerStyle === "profile" ? HEADER_HEIGHT_PROFILE : HEADER_HEIGHT_COMPACT;
  return {
    width,
    maxHeight,
    left: Math.round((videoWidth - width) / 2),
    top: Math.round(videoHeight * layout.windowTopMarginRatio),
    borderRadius: CARD_BORDER_RADIUS,
    headerHeight,
    maxContentHeight: maxHeight - headerHeight,
  };
}

const PhoneIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
    <path d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.3 21 3 13.7 3 4.9c0-.6.4-1 1-1h3.6c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.3 1z" />
  </svg>
);

const MenuDotsIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

const ChatHeader: React.FC<{
  headerStyle: ChatHeaderStyle;
  name: string;
  avatarUrl?: string;
  theme: ChatTheme;
  height: number;
}> = ({ headerStyle, name, avatarUrl, theme, height }) => {
  const tg = theme.telegram;
  const avatarSize = tg ? 64 : headerStyle === "profile" ? 64 : 44;

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

  // Telegram iOS: аватар слева, имя + статус стопкой рядом, звонок и меню справа
  if (tg) {
    return (
      <div
        style={{
          height,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: "0 28px",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        {avatar}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 2,
            flex: 1,
            minWidth: 0,
          }}
        >
          <span
            style={{
              color: theme.container.text,
              fontSize: 30,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </span>
          <span style={{ color: "#8a96a2", fontSize: 22 }}>
            {tg.headerStatus}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <PhoneIcon color={tg.accent} size={40} />
          <MenuDotsIcon color={tg.accent} size={40} />
        </div>
      </div>
    );
  }

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
  layoutSettings: LayoutSettings;
  /** Текущая высота карточки на этот кадр — считается снаружи через currentCardHeight() */
  height: number;
  children: React.ReactNode;
}> = ({
  theme,
  headerStyle,
  headerName,
  headerAvatarUrl,
  videoWidth,
  videoHeight,
  layoutSettings,
  height,
  children,
}) => {
  const layout = getChatWindowCardLayout(
    videoWidth,
    videoHeight,
    headerStyle,
    layoutSettings
  );

  return (
    <div
      style={{
        position: "absolute",
        top: layout.top,
        left: layout.left,
        width: layout.width,
        height,
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
