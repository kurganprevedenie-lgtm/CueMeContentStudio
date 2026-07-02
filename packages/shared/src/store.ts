import { create } from "zustand";

import { defaultThemeId, type ThemeId } from "./themes";
import type { Message } from "./types";

interface ChatState {
  messages: Message[];
  themeId: ThemeId;
  /** Голос ElevenLabs, выбранный для каждого отправителя */
  voiceBySender: Record<string, string>;
  addMessage: (message: Omit<Message, "id">) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
  setTheme: (themeId: ThemeId) => void;
  setVoice: (sender: string, voiceId: string) => void;
  setMessageAudio: (id: string, audioUrl: string) => void;
  clearAudio: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  themeId: defaultThemeId,
  voiceBySender: {},
  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...message, id: crypto.randomUUID() },
      ],
    })),
  removeMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    })),
  clearMessages: () => set({ messages: [] }),
  setTheme: (themeId) => set({ themeId }),
  setVoice: (sender, voiceId) =>
    set((state) => ({
      voiceBySender: { ...state.voiceBySender, [sender]: voiceId },
    })),
  setMessageAudio: (id, audioUrl) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, audioUrl } : m
      ),
    })),
  clearAudio: () =>
    set((state) => ({
      messages: state.messages.map(({ audioUrl: _audioUrl, ...rest }) => rest),
    })),
}));
