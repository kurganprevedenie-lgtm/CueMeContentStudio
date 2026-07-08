import { create } from "zustand";

import { defaultThemeId, type ThemeId } from "./themes";
import type {
  BackgroundSettings,
  Message,
  Participant,
  Suggestion,
} from "./types";

/** Переписка всегда между двумя участниками: participants[0] = левая сторона, participants[1] = правая */
export type ParticipantIndex = 0 | 1;

const emptySuggestion: Suggestion = { text: "", afterMessageId: null };

const defaultBackground: BackgroundSettings = {
  backgroundId: null,
  volume: 0,
  overlayOpacity: 0.3,
};

interface ChatState {
  messages: Message[];
  themeId: ThemeId;
  participants: [Participant, Participant];
  /** Голос ElevenLabs, выбранный для каждого отправителя (ключ — имя участника) */
  voiceBySender: Record<string, string>;
  suggestion: Suggestion;
  background: BackgroundSettings;
  addMessage: (input: { participantIndex: ParticipantIndex; text: string }) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
  setTheme: (themeId: ThemeId) => void;
  setParticipant: (index: ParticipantIndex, patch: Partial<Participant>) => void;
  setVoice: (sender: string, voiceId: string) => void;
  setMessageAudio: (id: string, audioUrl: string) => void;
  clearAudio: () => void;
  setSuggestionText: (text: string) => void;
  setSuggestionVoice: (voiceId: string) => void;
  setSuggestionAudio: (audioUrl: string) => void;
  setSuggestionAnchor: (messageId: string | null) => void;
  clearSuggestionAudio: () => void;
  setBackgroundId: (backgroundId: string | null) => void;
  setBackgroundVolume: (volume: number) => void;
  setBackgroundOverlayOpacity: (overlayOpacity: number) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  themeId: defaultThemeId,
  participants: [{ name: "Аня" }, { name: "Макс" }],
  voiceBySender: {},
  suggestion: emptySuggestion,
  background: defaultBackground,
  addMessage: ({ participantIndex, text }) =>
    set((state) => {
      const participant = state.participants[participantIndex];
      const message: Message = {
        id: crypto.randomUUID(),
        sender: participant.name,
        text,
        side: participantIndex === 0 ? "left" : "right",
        avatarUrl: participant.avatarUrl,
      };
      return { messages: [...state.messages, message] };
    }),
  removeMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    })),
  clearMessages: () => set({ messages: [] }),
  setTheme: (themeId) => set({ themeId }),
  setParticipant: (index, patch) =>
    set((state) => {
      const participants = [...state.participants] as [Participant, Participant];
      participants[index] = { ...participants[index], ...patch };
      return { participants };
    }),
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
  setSuggestionText: (text) =>
    set((state) => ({
      // меняем текст — старая озвучка больше ему не соответствует
      suggestion: { ...state.suggestion, text, audioUrl: undefined },
    })),
  setSuggestionVoice: (voiceId) =>
    set((state) => ({ suggestion: { ...state.suggestion, voiceId } })),
  setSuggestionAudio: (audioUrl) =>
    set((state) => ({ suggestion: { ...state.suggestion, audioUrl } })),
  setSuggestionAnchor: (afterMessageId) =>
    set((state) => ({ suggestion: { ...state.suggestion, afterMessageId } })),
  clearSuggestionAudio: () =>
    set((state) => {
      const { audioUrl: _audioUrl, ...rest } = state.suggestion;
      return { suggestion: rest };
    }),
  setBackgroundId: (backgroundId) =>
    set((state) => ({ background: { ...state.background, backgroundId } })),
  setBackgroundVolume: (volume) =>
    set((state) => ({ background: { ...state.background, volume } })),
  setBackgroundOverlayOpacity: (overlayOpacity) =>
    set((state) => ({
      background: { ...state.background, overlayOpacity },
    })),
}));
