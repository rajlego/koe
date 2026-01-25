import { create } from 'zustand';
import { saveWindowState } from '../sync/yjsProvider';
import type { WindowState, VoiceState } from '../models/types';

// Voice input mode: command (LLM processes) or dictate (direct append)
export type VoiceMode = 'command' | 'dictate';

interface WindowStoreState {
  // Active state
  activeThoughtId: string | null;
  activeWindowId: string | null;

  // Voice state (UI only, actual voice handled by Rust)
  voiceState: VoiceState;
  lastTranscript: string;
  lastError: string | null;

  // Voice mode for dictation
  voiceMode: VoiceMode;
  dictationTargetWindowId: string | null;  // Which window receives dictation

  // Open windows (for tracking, actual windows managed by Tauri)
  openWindows: Map<string, WindowState>;

  // Window display IDs (W1, W2, etc.) - maps windowId to display number
  windowDisplayIds: Map<string, number>;
  nextDisplayId: number;  // Counter for assigning new IDs

  // Actions
  setActiveThought: (thoughtId: string | null) => void;
  setActiveWindow: (windowId: string | null) => void;
  setVoiceState: (state: VoiceState) => void;
  setLastTranscript: (transcript: string) => void;
  setLastError: (error: string | null) => void;
  setVoiceMode: (mode: VoiceMode, targetWindowId?: string | null) => void;
  registerWindow: (window: WindowState) => void;
  unregisterWindow: (windowId: string) => void;
  updateWindowPosition: (windowId: string, x: number, y: number) => void;
  updateWindowSize: (windowId: string, width: number, height: number) => void;

  // Window ID helpers
  getDisplayId: (windowId: string) => number | undefined;
  getWindowByDisplayId: (displayId: number) => WindowState | undefined;
  getThoughtIdByDisplayId: (displayId: number) => string | undefined;
}

export const useWindowStore = create<WindowStoreState>((set, get) => ({
  // Initial state
  activeThoughtId: null,
  activeWindowId: null,
  voiceState: 'idle',
  lastTranscript: '',
  lastError: null,
  voiceMode: 'command',
  dictationTargetWindowId: null,
  openWindows: new Map(),
  windowDisplayIds: new Map(),
  nextDisplayId: 1,

  // Actions
  setActiveThought: (thoughtId) => set({ activeThoughtId: thoughtId }),
  setActiveWindow: (windowId) => set({ activeWindowId: windowId }),
  setVoiceState: (state) => set({ voiceState: state }),
  setLastTranscript: (transcript) => set({ lastTranscript: transcript }),
  setLastError: (error) => set({ lastError: error }),

  setVoiceMode: (mode, targetWindowId) =>
    set({
      voiceMode: mode,
      dictationTargetWindowId: targetWindowId ?? null,
    }),

  registerWindow: (window) =>
    set((state) => {
      const newWindows = new Map(state.openWindows);
      const newDisplayIds = new Map(state.windowDisplayIds);

      // Use persisted displayId if available, otherwise assign a new one
      let displayId = window.displayId;
      let newNextDisplayId = state.nextDisplayId;

      if (displayId !== undefined) {
        // Restore persisted displayId
        newDisplayIds.set(window.id, displayId);
        // Ensure nextDisplayId is always higher than any restored ID
        if (displayId >= newNextDisplayId) {
          newNextDisplayId = displayId + 1;
        }
      } else if (!newDisplayIds.has(window.id)) {
        // Assign new displayId
        displayId = state.nextDisplayId;
        newDisplayIds.set(window.id, displayId);
        newNextDisplayId = state.nextDisplayId + 1;
      } else {
        // Use existing displayId
        displayId = newDisplayIds.get(window.id);
      }

      // Store window with displayId
      const windowWithDisplayId = { ...window, displayId };
      newWindows.set(window.id, windowWithDisplayId);

      // Persist the window state with displayId
      saveWindowState(windowWithDisplayId);

      return {
        openWindows: newWindows,
        windowDisplayIds: newDisplayIds,
        nextDisplayId: newNextDisplayId,
      };
    }),

  unregisterWindow: (windowId) =>
    set((state) => {
      const newWindows = new Map(state.openWindows);
      newWindows.delete(windowId);

      // Remove display ID (number can be reused later if needed)
      const newDisplayIds = new Map(state.windowDisplayIds);
      newDisplayIds.delete(windowId);

      // If this was the dictation target, clear it
      const dictationTargetWindowId =
        state.dictationTargetWindowId === windowId ? null : state.dictationTargetWindowId;

      return {
        openWindows: newWindows,
        windowDisplayIds: newDisplayIds,
        dictationTargetWindowId,
      };
    }),

  updateWindowPosition: (windowId, x, y) =>
    set((state) => {
      const newWindows = new Map(state.openWindows);
      const window = newWindows.get(windowId);
      if (window) {
        // Ensure displayId is included in the update
        const displayId = state.windowDisplayIds.get(windowId);
        const updated = { ...window, x, y, displayId };
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
        // Ensure displayId is included in the update
        const displayId = state.windowDisplayIds.get(windowId);
        const updated = { ...window, width, height, displayId };
        newWindows.set(windowId, updated);
        // Persist to YJS
        saveWindowState(updated);
      }
      return { openWindows: newWindows };
    }),

  // Window ID helpers
  getDisplayId: (windowId) => {
    return get().windowDisplayIds.get(windowId);
  },

  getWindowByDisplayId: (displayId) => {
    const state = get();
    for (const [windowId, id] of state.windowDisplayIds) {
      if (id === displayId) {
        return state.openWindows.get(windowId);
      }
    }
    return undefined;
  },

  getThoughtIdByDisplayId: (displayId) => {
    const window = get().getWindowByDisplayId(displayId);
    return window?.thoughtId;
  },
}));
