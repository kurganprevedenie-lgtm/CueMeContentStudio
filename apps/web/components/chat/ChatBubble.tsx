"use client";

import { Volume2Icon } from "lucide-react";
import type { ChatTheme, Message } from "@cueme/shared";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Статичное время отправки для стилизованного мок-чата (реального timestamp у Message нет) */
const MESSAGE_TIME = "9:41";

/** Двойная галочка «прочитано» Telegram — инлайн-SVG, чтобы не тянуть иконочный шрифт в кадр */
function TelegramDoubleCheck({ color }: { color: string }) {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden>
      <path
        d="M1 6.2 3.4 8.6 8.6 2.4M6.6 8 7.4 8.8 12.6 2.6"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface ChatBubbleProps {
  message: Message;
  theme: ChatTheme;
  /** Если передан и у сообщения есть audioUrl — показываем кнопку прослушивания */
  onPlayAudio?: () => void;
}

export function ChatBubble({ message, theme, onPlayAudio }: ChatBubbleProps) {
  const isRight = message.side === "right";
  const bubble = isRight ? theme.bubble.right : theme.bubble.left;
  const cornerRadius = theme.bubble.borderRadius;
  const tg = theme.telegram;
  const metaColor = tg ? (isRight ? tg.outgoingMeta : tg.incomingMeta) : "";
  const hasImage = Boolean(message.imageUrl);
  const hasText = message.text.length > 0;

  return (
    <div className={cn("flex items-end gap-3", isRight && "flex-row-reverse")}>
      <Avatar size="lg">
        {message.avatarUrl ? (
          <AvatarImage src={message.avatarUrl} alt={message.sender} />
        ) : null}
        <AvatarFallback>
          {message.sender.charAt(0).toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "flex max-w-[78%] flex-col gap-1",
          isRight && "items-end"
        )}
      >
        {/* Telegram 1-на-1 — без подписей имён над пузырями (как в референсе) */}
        {tg ? null : (
          <span className="px-1 text-sm" style={{ color: theme.senderLabel }}>
            {message.sender}
          </span>
        )}
        <div
          className={cn(
            "overflow-hidden text-base break-words whitespace-pre-wrap",
            !hasImage && "px-4 py-2.5"
          )}
          style={{
            background: bubble.background,
            color: bubble.text,
            // Telegram: у входящих «хвостик» слева-снизу, у исходящих справа-снизу
            // (острый угол); у iMessage/Instagram — прежний мелкий радиус.
            // Четыре отдельных угла вместо borderRadius+borderBottom*Radius —
            // React ругается на смешивание shorthand и longhand в одном style
            borderTopLeftRadius: cornerRadius,
            borderTopRightRadius: cornerRadius,
            borderBottomLeftRadius: isRight ? cornerRadius : tg ? "4px" : "6px",
            borderBottomRightRadius: isRight ? (tg ? "4px" : "6px") : cornerRadius,
            boxShadow: tg ? "0 1px 1px rgba(0,0,0,0.08)" : undefined,
          }}
        >
          {/* Превью в браузере — просто object-fit: contain в разумных рамках,
              без точного расчёта размера как в Remotion-рендере (см.
              packages/remotion/src/bubbleMetrics.ts) — здесь достаточно,
              браузер сам вёрстывает окружающий flex-контейнер */}
          {hasImage ? (
            // width/height: auto + max-width/max-height — браузер сам вписывает
            // РЕАЛЬНЫЕ пропорции фото в рамку (как object-fit: contain для
            // replaced-элемента), без искажений. w-full здесь нельзя: пузырь —
            // flex-item с shrink-to-fit шириной (см. родительский div ниже,
            // max-w-[78%]), а width:100% у картинки внутри такого контейнера
            // разворачивается в «залить всю доступную ширину колонки» —
            // пузырь с фото становился шире соседних текстовых и визуально
            // «съезжал» относительно остальной переписки
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.imageUrl}
              alt=""
              className="block h-auto w-auto"
              style={{ maxWidth: 260, maxHeight: 260 }}
            />
          ) : null}
          {hasText ? (
            <div className={cn(hasImage && "px-4 py-2.5")}>
              {/* Telegram: время + галочки прочтения float:right — если помещаются,
                  садятся в конец последней строки, иначе переносятся (как в реальном
                  Telegram) */}
              {tg ? (
                <span
                  className="ml-2 inline-flex translate-y-1 items-center gap-1 text-xs select-none"
                  style={{ float: "right", color: metaColor }}
                >
                  {MESSAGE_TIME}
                  {/* галочки — синим акцентом, не цветом времени */}
                  {isRight ? <TelegramDoubleCheck color={tg.accent} /> : null}
                </span>
              ) : null}
              {message.text}
            </div>
          ) : null}
        </div>
      </div>
      {message.audioUrl && onPlayAudio ? (
        <button
          type="button"
          aria-label="Прослушать озвучку"
          className="self-center rounded-full p-1 transition-opacity hover:opacity-70"
          style={{ color: theme.senderLabel }}
          onClick={onPlayAudio}
        >
          <Volume2Icon className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
