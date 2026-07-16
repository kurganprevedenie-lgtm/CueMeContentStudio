import { create } from "zustand";

import { defaultThemeId, type ThemeId } from "./themes";
import {
  DEFAULT_BOT_BANNER_SETTINGS,
  DEFAULT_LAYOUT_SETTINGS,
  type BackgroundSettings,
  type BotBannerPosition,
  type BotBannerSettings,
  type BotBannerTiming,
  type LayoutSettings,
  type Message,
  type Participant,
  type Suggestion,
} from "./types";

/** Переписка всегда между двумя участниками: participants[0] = левая сторона, participants[1] = правая */
export type ParticipantIndex = 0 | 1;

const emptySuggestion: Suggestion = { text: "", afterMessageId: null };

/**
 * Настройки макета, сохранённые пользователем через кнопку «Сделать
 * стандартом» — живут в localStorage браузера (бэкенда с пользовательскими
 * настройками нет), поэтому доступны только на клиенте. При заходе на
 * страницу конструктор сразу открывается с этими значениями вместо
 * DEFAULT_LAYOUT_SETTINGS, а «Сбросить» откатывает к ним же, а не к
 * исходным зашитым в код значениям.
 */
const LAYOUT_DEFAULTS_STORAGE_KEY = "cueme-layout-defaults";

function loadUserDefaultLayoutSettings(): LayoutSettings {
  if (typeof window === "undefined") return DEFAULT_LAYOUT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(LAYOUT_DEFAULTS_STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT_SETTINGS;
    return { ...DEFAULT_LAYOUT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_LAYOUT_SETTINGS;
  }
}

let userDefaultLayoutSettings = loadUserDefaultLayoutSettings();

const defaultBackground: BackgroundSettings = {
  backgroundId: null,
  volume: 0,
  overlayOpacity: 0.3,
};

// Модуль-локальный ambient: в этом пакете нет @types/node, но обращение
// должно остаться буквально `process.env.NEXT_PUBLIC_*`, чтобы Next заинлайнил
// значение в браузерный бандл (globalThis.process такое инлайнирование не
// ловит). Declare стирается при компиляции и не мешает web-tsc (там node-типы).
declare const process: { env: Record<string, string | undefined> };

// NEXT_PUBLIC_ — значение должно быть доступно в браузере: и превью
// (Remotion Player), и форма настроек баннера рендерятся на клиенте.
// Не хардкодим юзернейм бота в коде — только дефолт текстового поля, само
// поле пользователь может отредактировать под конкретное видео.
const defaultBotBanner: BotBannerSettings = {
  ...DEFAULT_BOT_BANNER_SETTINGS,
  text: process.env.NEXT_PUBLIC_CUEME_BOT_USERNAME ?? "",
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
  /**
   * Ставит/снимает подсказку CueMe (isHintMoment/hintText) на уже
   * добавленное сообщение — настраивается из SuggestionPanel («Подсказка от
   * CueMe»), не при создании сообщения (см. MessageForm). Пустой/пробельный
   * text снимает подсказку.
   */
  setMessageHint: (id: string, hintText: string) => void;
  /** Озвучка текста подсказки (ElevenLabs) для конкретного сообщения */
  setMessageHintAudio: (id: string, audioUrl: string) => void;
  clearMessageHintAudio: (id: string) => void;
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
  /**
   * Точка старта фрагмента (сек) для каждого фонового видео по его id —
   * часть конфига проекта, а не отдельная сущность в хранилище файлов
   */
  backgroundTrimStartById: Record<string, number>;
  setBackgroundTrimStart: (backgroundId: string, startSec: number) => void;
  /** Вызывается после удаления видео из библиотеки — чистим ссылки на него */
  forgetBackground: (backgroundId: string) => void;
  layoutSettings: LayoutSettings;
  /** Подтягивает сохранённые в localStorage настройки макета — вызывать один раз после монтирования (см. LayoutSettingsPanel) */
  hydrateLayoutSettings: () => void;
  setWindowWidthRatio: (v: number) => void;
  setWindowHeightRatio: (v: number) => void;
  setWindowTopMarginRatio: (v: number) => void;
  setMessageFontScale: (v: number) => void;
  setMessageSpacingScale: (v: number) => void;
  resetLayoutSettings: () => void;
  /** Сохраняет текущие layoutSettings как новый стандарт (localStorage) — «Сбросить» будет откатывать сюда */
  saveLayoutSettingsAsDefault: () => void;
  botBanner: BotBannerSettings;
  setBotBannerEnabled: (enabled: boolean) => void;
  setBotBannerText: (text: string) => void;
  setBotBannerPosition: (position: BotBannerPosition) => void;
  setBotBannerTiming: (timing: BotBannerTiming) => void;
  setBotBannerTimingDurationSec: (v: number) => void;
  setBotBannerPeriodicIntervalSec: (v: number) => void;
  setBotBannerPeriodicVisibleSec: (v: number) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
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
  setMessageHint: (id, hintText) =>
    set((state) => {
      const trimmed = hintText.trim();
      return {
        messages: state.messages.map((m) => {
          if (m.id !== id) return m;
          if (!trimmed) {
            const {
              isHintMoment: _isHintMoment,
              hintText: _hintText,
              hintAudioUrl: _hintAudioUrl,
              ...rest
            } = m;
            return rest;
          }
          // текст изменился — старая озвучка ему больше не соответствует.
          // Храним hintText КАК ЕСТЬ (не .trim()) — иначе пробел в конце,
          // который пользователь только что набрал в Textarea, тут же
          // обрезался бы обратно следующим рендером controlled-инпута, и
          // ввести его вообще было бы нельзя. trimmed используется только
          // для проверки "не пусто ли", обрезка при необходимости — на
          // стороне чтения (см. ChatVideo.tsx: message.hintText?.trim()).
          const { hintAudioUrl: _staleAudio, ...rest } = m;
          return { ...rest, isHintMoment: true, hintText };
        }),
      };
    }),
  setMessageHintAudio: (id, audioUrl) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, hintAudioUrl: audioUrl } : m
      ),
    })),
  clearMessageHintAudio: (id) =>
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== id) return m;
        const { hintAudioUrl: _hintAudioUrl, ...rest } = m;
        return rest;
      }),
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
  backgroundTrimStartById: {},
  setBackgroundTrimStart: (backgroundId, startSec) =>
    set((state) => ({
      backgroundTrimStartById: {
        ...state.backgroundTrimStartById,
        [backgroundId]: startSec,
      },
    })),
  forgetBackground: (backgroundId) =>
    set((state) => {
      const { [backgroundId]: _removed, ...restTrims } =
        state.backgroundTrimStartById;
      return {
        backgroundTrimStartById: restTrims,
        background:
          state.background.backgroundId === backgroundId
            ? { ...state.background, backgroundId: null }
            : state.background,
      };
    }),
  // Всегда стартуем с DEFAULT_LAYOUT_SETTINGS (не userDefaultLayoutSettings) —
  // это значение одинаково и на сервере, и при первом клиентском рендере
  // (до гидратации), в отличие от localStorage. Сохранённое значение
  // подтягивается отдельно, уже после монтирования, через hydrateLayoutSettings()
  // (см. LayoutSettingsPanel) — так React обновит текст уже после гидратации,
  // без рассинхрона "сервер написал 87%, клиент — 72%".
  layoutSettings: DEFAULT_LAYOUT_SETTINGS,
  hydrateLayoutSettings: () => {
    userDefaultLayoutSettings = loadUserDefaultLayoutSettings();
    set({ layoutSettings: userDefaultLayoutSettings });
  },
  setWindowWidthRatio: (v) =>
    set((state) => ({
      layoutSettings: { ...state.layoutSettings, windowWidthRatio: v },
    })),
  setWindowHeightRatio: (v) =>
    set((state) => ({
      layoutSettings: { ...state.layoutSettings, windowHeightRatio: v },
    })),
  setWindowTopMarginRatio: (v) =>
    set((state) => ({
      layoutSettings: { ...state.layoutSettings, windowTopMarginRatio: v },
    })),
  setMessageFontScale: (v) =>
    set((state) => ({
      layoutSettings: { ...state.layoutSettings, messageFontScale: v },
    })),
  setMessageSpacingScale: (v) =>
    set((state) => ({
      layoutSettings: { ...state.layoutSettings, messageSpacingScale: v },
    })),
  resetLayoutSettings: () => set({ layoutSettings: userDefaultLayoutSettings }),
  saveLayoutSettingsAsDefault: () => {
    userDefaultLayoutSettings = get().layoutSettings;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          LAYOUT_DEFAULTS_STORAGE_KEY,
          JSON.stringify(userDefaultLayoutSettings)
        );
      } catch {
        // localStorage недоступен (приватный режим и т.п.) — просто не сохраняем между сессиями
      }
    }
  },
  botBanner: defaultBotBanner,
  setBotBannerEnabled: (enabled) =>
    set((state) => ({ botBanner: { ...state.botBanner, enabled } })),
  setBotBannerText: (text) =>
    set((state) => ({ botBanner: { ...state.botBanner, text } })),
  setBotBannerPosition: (position) =>
    set((state) => ({ botBanner: { ...state.botBanner, position } })),
  setBotBannerTiming: (timing) =>
    set((state) => ({ botBanner: { ...state.botBanner, timing } })),
  setBotBannerTimingDurationSec: (v) =>
    set((state) => ({
      botBanner: { ...state.botBanner, timingDurationSec: v },
    })),
  setBotBannerPeriodicIntervalSec: (v) =>
    set((state) => ({
      botBanner: { ...state.botBanner, periodicIntervalSec: v },
    })),
  setBotBannerPeriodicVisibleSec: (v) =>
    set((state) => ({
      botBanner: { ...state.botBanner, periodicVisibleSec: v },
    })),
}));
