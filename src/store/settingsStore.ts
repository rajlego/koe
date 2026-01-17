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

  // API Keys (stored locally, user-provided)
  apiKeys: {
    anthropic: string;
    openai: string;
    elevenLabs: string;
    fal: string;
    stability: string;
    replicate: string;
  };

  // Image Generation
  imageProvider: 'openai' | 'fal' | 'stability' | 'replicate';

  // Setup
  setupCompleted: boolean;

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
  setApiKey: (provider: keyof SettingsState['apiKeys'], key: string) => void;
  clearApiKey: (provider: keyof SettingsState['apiKeys']) => void;
  setImageProvider: (provider: SettingsState['imageProvider']) => void;
  setSetupCompleted: (completed: boolean) => void;
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
      apiKeys: {
        anthropic: '',
        openai: '',
        elevenLabs: '',
        fal: '',
        stability: '',
        replicate: '',
      },
      imageProvider: 'fal',
      setupCompleted: false,

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

      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),

      clearApiKey: (provider) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: '' },
        })),

      setImageProvider: (provider) => set({ imageProvider: provider }),

      setSetupCompleted: (completed) => set({ setupCompleted: completed }),
    }),
    {
      name: 'koe-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Helper to get API key (checks store first, then env vars)
export function getApiKey(provider: keyof SettingsState['apiKeys']): string {
  const storeKey = useSettingsStore.getState().apiKeys[provider];
  if (storeKey) return storeKey;

  // Fallback to environment variables
  const envMap: Record<keyof SettingsState['apiKeys'], string> = {
    anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
    openai: import.meta.env.VITE_OPENAI_API_KEY || '',
    elevenLabs: import.meta.env.VITE_ELEVENLABS_API_KEY || '',
    fal: import.meta.env.VITE_FAL_API_KEY || '',
    stability: import.meta.env.VITE_STABILITY_API_KEY || '',
    replicate: import.meta.env.VITE_REPLICATE_API_KEY || '',
  };

  return envMap[provider];
}
