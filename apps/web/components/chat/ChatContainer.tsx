"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { XIcon } from "lucide-react";
import { useChatStore } from "@cueme/shared";

import { ChatBubble } from "@/components/chat/ChatBubble";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ChatContainer() {
  const messages = useChatStore((s) => s.messages);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      {messages.length === 0 ? (
        <p className="m-auto text-center text-sm text-muted-foreground">
          Сообщений пока нет — добавь первое через форму
        </p>
      ) : (
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="group relative"
            >
              <ChatBubble message={message} />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Удалить сообщение"
                className={cn(
                  "absolute top-0 opacity-0 transition-opacity group-hover:opacity-100",
                  message.side === "right" ? "left-0" : "right-0"
                )}
                onClick={() => removeMessage(message.id)}
              >
                <XIcon />
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
