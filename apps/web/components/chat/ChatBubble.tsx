"use client";

import { Volume2Icon } from "lucide-react";
import type { ChatTheme, Message } from "@cueme/shared";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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
        <span className="px-1 text-sm" style={{ color: theme.senderLabel }}>
          {message.sender}
        </span>
        <div
          className="px-4 py-2.5 text-base break-words whitespace-pre-wrap"
          style={{
            background: bubble.background,
            color: bubble.text,
            // Четыре отдельных угла вместо borderRadius+borderBottom*Radius —
            // React ругается на смешивание shorthand и longhand в одном style
            borderTopLeftRadius: cornerRadius,
            borderTopRightRadius: cornerRadius,
            borderBottomLeftRadius: isRight ? cornerRadius : "6px",
            borderBottomRightRadius: isRight ? "6px" : cornerRadius,
          }}
        >
          {message.text}
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
