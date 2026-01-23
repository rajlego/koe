import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboard } from './useKeyboard';
import { useWindowStore } from '../store/windowStore';
import { useSettingsStore } from '../store/settingsStore';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

// Mock useWindows hook
vi.mock('./useWindows', () => ({
  useWindows: () => ({
    createThoughtWindow: vi.fn(),
    closeThoughtWindow: vi.fn(),
  }),
}));

// Mock sync
vi.mock('../sync', () => ({
  addThought: vi.fn(),
}));

// Mock LLM service
vi.mock('../services/llm', () => ({
  performUndo: vi.fn(),
}));

describe('useKeyboard', () => {
  beforeEach(() => {
    // Reset stores to initial state
    useWindowStore.setState({
      activeThoughtId: null,
      activeWindowId: null,
      voiceState: 'idle',
      lastTranscript: '',
      lastError: null,
      openWindows: new Map(),
    });
    useSettingsStore.setState({
      voiceEnabled: true,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Escape key - voice toggle', () => {
    it('should call onToggleVoice callback when Esc is pressed', () => {
      const onToggleVoice = vi.fn();
      renderHook(() => useKeyboard({ onToggleVoice }));

      // Simulate Escape key press
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(onToggleVoice).toHaveBeenCalledTimes(1);
    });

    it('should work even when focus is in an input field', () => {
      const onToggleVoice = vi.fn();
      renderHook(() => useKeyboard({ onToggleVoice }));

      // Create an input element and focus it
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      // Simulate Escape key press while in input
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      Object.defineProperty(event, 'target', { value: input });
      window.dispatchEvent(event);

      // Escape should still work even in input
      expect(onToggleVoice).toHaveBeenCalledTimes(1);

      document.body.removeChild(input);
    });

    it('should use internal toggleVoice when no callback provided', async () => {
      const { invoke } = await import('@tauri-apps/api/core');

      // Set voice state to idle
      useWindowStore.setState({ voiceState: 'idle' });
      useSettingsStore.setState({ voiceEnabled: true });

      renderHook(() => useKeyboard());

      // Simulate Escape key press
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      window.dispatchEvent(event);

      // Should call start_voice_capture since state is idle
      expect(invoke).toHaveBeenCalledWith('start_voice_capture');
    });

    it('should stop voice when already listening', async () => {
      const { invoke } = await import('@tauri-apps/api/core');

      // Set voice state to listening
      useWindowStore.setState({ voiceState: 'listening' });

      renderHook(() => useKeyboard());

      // Simulate Escape key press
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      window.dispatchEvent(event);

      // Should call stop_voice_capture since state is listening
      expect(invoke).toHaveBeenCalledWith('stop_voice_capture');
    });
  });

  describe('Cmd+, - open settings', () => {
    it('should call onOpenSettings when Cmd+, is pressed', () => {
      const onOpenSettings = vi.fn();
      renderHook(() => useKeyboard({ onOpenSettings }));

      const event = new KeyboardEvent('keydown', {
        key: ',',
        metaKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onOpenSettings when typing in input', () => {
      const onOpenSettings = vi.fn();
      renderHook(() => useKeyboard({ onOpenSettings }));

      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        key: ',',
        metaKey: true,
        bubbles: true,
      });
      Object.defineProperty(event, 'target', { value: input });
      window.dispatchEvent(event);

      expect(onOpenSettings).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });
  });

  describe('Cmd+Shift+H - open history', () => {
    it('should call onOpenHistory when Cmd+Shift+H is pressed', () => {
      const onOpenHistory = vi.fn();
      renderHook(() => useKeyboard({ onOpenHistory }));

      const event = new KeyboardEvent('keydown', {
        key: 'h',
        metaKey: true,
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(onOpenHistory).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cmd+Shift+V - toggle voice enabled', () => {
    it('should toggle voice enabled setting', () => {
      useSettingsStore.setState({ voiceEnabled: true });
      renderHook(() => useKeyboard());

      const event = new KeyboardEvent('keydown', {
        key: 'v',
        metaKey: true,
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(useSettingsStore.getState().voiceEnabled).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should remove event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => useKeyboard());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });
  });
});
