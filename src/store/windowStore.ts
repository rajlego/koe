import { create } from 'zustand';
import { saveWindowState } from '../sync/yjsProvider';
import type { WindowState, VoiceState } from '../models/types';

interface WindowStoreState {
  // Active state
  activeThoughtId: string | null;
  activeWindowId: string | null;

  // Voice state (UI only, actual voice handled by Rust)
  voiceState: VoiceState;
  lastTranscript: string;
  lastError: string | null;

  // Open windows (for tracking, actual windows managed by Tauri)
  openWindows: Map<string, WindowState>;

  // Actions
  setActiveThought: (thoughtId: string | null) => void;
  setActiveWindow: (windowId: string | null) => void;
  setVoiceState: (state: VoiceState) => void;
  setLastTranscript: (transcript: string) => void;
  setLastError: (error: string | null) => void;
  registerWindow: (window: WindowState) => void;
  unregisterWindow: (windowId: string) => void;
  updateWindowPosition: (windowId: string, x: number, y: number) => void;
  updateWindowSize: (windowId: string, width: number, height: number) => void;
}

export const useWindowStore = create<WindowStoreState>((set) => ({
  // Initial state
  activeThoughtId: null,
  activeWindowId: null,
  voiceState: 'idle',
  lastTranscript: '',
  lastError: null,
  openWindows: new Map(),

  // Actions
  setActiveThought: (thoughtId) => set({ activeThoughtId: thoughtId }),
  setActiveWindow: (windowId) => set({ activeWindowId: windowId }),
  setVoiceState: (state) => set({ voiceState: state }),
  setLastTranscript: (transcript) => set({ lastTranscript: transcript }),
  setLastError: (error) => set({ lastError: error }),

  registerWindow: (window) =>
    set((state) => {
      const newWindows = new Map(state.openWindows);
      newWindows.set(window.id, window);
      return { openWindows: newWindows };
    }),

  unregisterWindow: (windowId) =>
    set((state) => {
      const newWindows = new Map(state.openWindows);
      newWindows.delete(windowId);
      return { openWindows: newWindows };
    }),

  updateWindowPosition: (windowId, x, y) =>
    set((state) => {
      const newWindows = new Map(state.openWindows);
      const window = newWindows.get(windowId);
      if (window) {
        const updated = { ...window, x, y };
        newWindows.set(windowId, updated);
        // Persist to YJS
        saveWindowState(updated);
      }
      return { openWindows: newWindows };
    }),

  updateWindowSize: (windowId, width, height) =>
    set((state) => {
      const newWindows = new Map(state.openWindows);
      const window = newWindows.get(windowId);
      if (window) {
        const updated = { ...window, width, height };
        newWindows.set(windowId, updated);
        // Persist to YJS
        saveWindowState(updated);
      }
      return { openWindows: newWindows };
    }),
}));
