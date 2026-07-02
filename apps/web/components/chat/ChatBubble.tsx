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
  const tailRadius = isRight
    ? { borderBottomRightRadius: "6px" }
    : { borderBottomLeftRadius: "6px" };

  return (
    <div className={cn("flex items-end gap-2", isRight && "flex-row-reverse")}>
      <Avatar size="sm">
        {message.avatarUrl ? (
          <AvatarImage src={message.avatarUrl} alt={message.sender} />
        ) : null}
        <AvatarFallback>
          {message.sender.charAt(0).toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "flex max-w-[75%] flex-col gap-0.5",
          isRight && "items-end"
        )}
      >
        <span className="px-1 text-xs" style={{ color: theme.senderLabel }}>
          {message.sender}
        </span>
        <div
          className="px-3.5 py-2 text-sm break-words whitespace-pre-wrap"
          style={{
            background: bubble.background,
            color: bubble.text,
            borderRadius: theme.bubble.borderRadius,
            ...tailRadius,
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
