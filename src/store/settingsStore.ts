import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CustomPosition } from '../models/types';
import type { ThemeName } from '../styles/themes';

interface SettingsState {
  // Display
  displayMode: 'control' | 'integrated';
  theme: ThemeName;

  // Voice
  voiceEnabled: boolean;
  ttsEnabled: boolean;

  // ElevenLabs TTS
  elevenLabsVoiceId: string | null;
  elevenLabsStreaming: boolean;

  // Sound
  soundsEnabled: boolean;

  // Window
  restoreWindows: boolean;
  customPositions: CustomPosition[];

  // Actions
  setDisplayMode: (mode: 'control' | 'integrated') => void;
  setTheme: (theme: ThemeName) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setTtsEnabled: (enabled: boolean) => void;
  setElevenLabsVoiceId: (voiceId: string | null) => void;
  setElevenLabsStreaming: (enabled: boolean) => void;
  setSoundsEnabled: (enabled: boolean) => void;
  setRestoreWindows: (enabled: boolean) => void;
  addCustomPosition: (position: CustomPosition) => void;
  removeCustomPosition: (name: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Defaults
      displayMode: 'control',
      theme: 'dark',
      voiceEnabled: true,
      ttsEnabled: false,
      elevenLabsVoiceId: null,
      elevenLabsStreaming: true,
      soundsEnabled: true,
      restoreWindows: true,
      customPositions: [],

      // Actions
      setDisplayMode: (mode) => set({ displayMode: mode }),
      setTheme: (theme) => set({ theme }),
      setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
      setTtsEnabled: (enabled) => set({ ttsEnabled: enabled }),
      setElevenLabsVoiceId: (voiceId) => set({ elevenLabsVoiceId: voiceId }),
      setElevenLabsStreaming: (enabled) => set({ elevenLabsStreaming: enabled }),
      setSoundsEnabled: (enabled) => set({ soundsEnabled: enabled }),
      setRestoreWindows: (enabled) => set({ restoreWindows: enabled }),

      addCustomPosition: (position) =>
        set((state) => ({
          customPositions: [
            ...state.customPositions.filter((p) => p.name !== position.name),
            position,
          ],
        })),

      removeCustomPosition: (name) =>
        set((state) => ({
          customPositions: state.customPositions.filter((p) => p.name !== name),
        })),
    }),
    {
      name: 'koe-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
