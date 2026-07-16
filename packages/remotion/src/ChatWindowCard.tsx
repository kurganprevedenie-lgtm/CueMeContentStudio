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

const BackChevron: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M15 5 8 12l7 7" />
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

  // Telegram iOS (как в референсе): «‹ Назад» слева синим, имя + статус по
  // центру, круглый аватар справа
  if (tg) {
    return (
      <div
        style={{
          height,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 22px",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            color: tg.accent,
            fontSize: 26,
            flexShrink: 0,
          }}
        >
          <BackChevron color={tg.accent} size={34} />
          Назад
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <span
            style={{
              color: theme.container.text,
              fontSize: 30,
              fontWeight: 600,
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </span>
          <span style={{ color: "#8a96a2", fontSize: 21 }}>
            {tg.headerStatus}
          </span>
        </div>
        {avatar}
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
  /**
   * Слой поверх области сообщений, обрезанный границами окна (overflow) — сюда
   * ChatVideo кладёт push-уведомление CueMe, чтобы оно выезжало из верха
   * диалогового окна (из-под шапки), а не из верха всего кадра.
   */
  overlay?: React.ReactNode;
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
  overlay,
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
        {overlay ? (
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {overlay}
          </div>
        ) : null}
      </div>
    </div>
  );
};
