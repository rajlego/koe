import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CustomPosition } from '../models/types';

interface SettingsState {
  // Display
  displayMode: 'control' | 'integrated';
  theme: 'dark' | 'light';

  // Voice
  voiceEnabled: boolean;
  ttsEnabled: boolean;

  // Sound
  soundsEnabled: boolean;

  // Window
  restoreWindows: boolean;
  customPositions: CustomPosition[];

  // Actions
  setDisplayMode: (mode: 'control' | 'integrated') => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setTtsEnabled: (enabled: boolean) => void;
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
      soundsEnabled: true,
      restoreWindows: true,
      customPositions: [],

      // Actions
      setDisplayMode: (mode) => set({ displayMode: mode }),
      setTheme: (theme) => set({ theme }),
      setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
      setTtsEnabled: (enabled) => set({ ttsEnabled: enabled }),
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
