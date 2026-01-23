import { useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWindowStore } from '../store/windowStore';
import { useSettingsStore } from '../store/settingsStore';
import { useWindows } from './useWindows';
import { addThought } from '../sync';
import { performUndo } from '../services/llm';

interface KeyboardOptions {
  onOpenSettings?: () => void;
  onOpenHistory?: () => void;
  onToggleVoice?: () => void;
}

export function useKeyboard(options: KeyboardOptions = {}) {
  const { voiceState, setVoiceState } = useWindowStore();
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const setVoiceEnabled = useSettingsStore((s) => s.setVoiceEnabled);
  const { createThoughtWindow, closeThoughtWindow } = useWindows();
  const activeWindowId = useWindowStore((s) => s.activeWindowId);

  const toggleVoice = useCallback(async () => {
    if (voiceState === 'listening') {
      await invoke('stop_voice_capture');
      setVoiceState('idle');
    } else if (voiceState === 'idle' && voiceEnabled) {
      await invoke('start_voice_capture');
      setVoiceState('listening');
    }
  }, [voiceState, voiceEnabled, setVoiceState]);

  const createNewThought = useCallback(async () => {
    const id = crypto.randomUUID();
    addThought({
      id,
      content: '',
      type: 'note',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    });
    await createThoughtWindow(id);
  }, [createThoughtWindow]);

  const closeCurrentWindow = useCallback(async () => {
    if (activeWindowId) {
      await closeThoughtWindow(activeWindowId);
    }
  }, [activeWindowId, closeThoughtWindow]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      const isEditing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Escape always works (toggle voice)
      if (e.key === 'Escape') {
        e.preventDefault();
        // Use callback if provided, otherwise use internal toggleVoice
        if (options.onToggleVoice) {
          options.onToggleVoice();
        } else {
          toggleVoice();
        }
        return;
      }

      // Other shortcuts only when not editing
      if (isEditing) return;

      // Cmd+N: New thought
      if (e.key === 'n' && e.metaKey) {
        e.preventDefault();
        createNewThought();
        return;
      }

      // Cmd+W: Close current window
      if (e.key === 'w' && e.metaKey) {
        e.preventDefault();
        closeCurrentWindow();
        return;
      }

      // Cmd+,: Open settings
      if (e.key === ',' && e.metaKey) {
        e.preventDefault();
        options.onOpenSettings?.();
        return;
      }

      // Cmd+Shift+H: Open thought history
      if (e.key === 'h' && e.metaKey && e.shiftKey) {
        e.preventDefault();
        options.onOpenHistory?.();
        return;
      }

      // Cmd+Shift+V: Toggle voice enabled
      if (e.key === 'v' && e.metaKey && e.shiftKey) {
        e.preventDefault();
        setVoiceEnabled(!voiceEnabled);
        return;
      }

      // Cmd+Z: Undo
      if (e.key === 'z' && e.metaKey && !e.shiftKey) {
        e.preventDefault();
        performUndo();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    toggleVoice,
    createNewThought,
    closeCurrentWindow,
    voiceEnabled,
    setVoiceEnabled,
    options,
  ]);

  return {
    toggleVoice,
    createNewThought,
    closeCurrentWindow,
  };
}
