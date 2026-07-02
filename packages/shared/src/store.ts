import { create } from "zustand";

import { defaultThemeId, type ThemeId } from "./themes";
import type { Message } from "./types";

interface ChatState {
  messages: Message[];
  themeId: ThemeId;
  addMessage: (message: Omit<Message, "id">) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
  setTheme: (themeId: ThemeId) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  themeId: defaultThemeId,
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
}));
