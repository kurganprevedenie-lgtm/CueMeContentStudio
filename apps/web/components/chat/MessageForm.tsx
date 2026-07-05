"use client";

import { useState } from "react";
import { useChatStore, type ParticipantIndex } from "@cueme/shared";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function MessageForm() {
  const participants = useChatStore((s) => s.participants);
  const addMessage = useChatStore((s) => s.addMessage);
  const [activeIndex, setActiveIndex] = useState<ParticipantIndex>(0);
  const [text, setText] = useState("");

  const canSubmit = text.trim().length > 0;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    addMessage({ participantIndex: activeIndex, text: text.trim() });
    setText("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новое сообщение</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {participants.map((participant, index) => {
              const idx = index as ParticipantIndex;
              const active = activeIndex === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted"
                  )}
                >
                  <Avatar size="default">
                    {participant.avatarUrl ? (
                      <AvatarImage
                        src={participant.avatarUrl}
                        alt={participant.name}
                      />
                    ) : null}
                    <AvatarFallback>
                      {participant.name.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm font-medium">
                    {participant.name || `Участник ${idx + 1}`}
                  </span>
                </button>
              );
            })}
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ты не поверишь, что сейчас было…"
            rows={3}
            autoFocus
          />
          <Button type="submit" disabled={!canSubmit}>
            Добавить в диалог
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
