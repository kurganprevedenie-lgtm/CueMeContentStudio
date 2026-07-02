"use client";

import type { Message } from "@cueme/shared";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  message: Message;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isRight = message.side === "right";

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
        <span className="px-1 text-xs text-muted-foreground">
          {message.sender}
        </span>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm break-words whitespace-pre-wrap",
            isRight
              ? "rounded-br-md bg-blue-500 text-white"
              : "rounded-bl-md bg-muted text-foreground"
          )}
        >
          {message.text}
        </div>
      </div>
    </div>
  );
}
