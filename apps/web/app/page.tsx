import { ChatContainer } from "@/components/chat/ChatContainer";
import { MessageForm } from "@/components/chat/MessageForm";
import { ParticipantsEditor } from "@/components/chat/ParticipantsEditor";
import { ThemeSelector } from "@/components/chat/ThemeSelector";
import { VideoPreview } from "@/components/chat/VideoPreview";
import { VoicePanel } from "@/components/chat/VoicePanel";

export default function Home() {
  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 items-start gap-8 p-6 md:grid-cols-[1fr_minmax(0,24rem)]">
      <section className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">CueMe Content Studio</h1>
          <p className="text-sm text-muted-foreground">
            Собери диалог — превью справа обновляется сразу
          </p>
        </header>
        <ParticipantsEditor />
        <MessageForm />
        <VoicePanel />
      </section>
      <section className="flex flex-col gap-3">
        <ThemeSelector />
        <div className="flex h-[640px] flex-col overflow-hidden rounded-3xl border shadow-sm">
          <ChatContainer />
        </div>
        <VideoPreview />
      </section>
    </main>
  );
}
