import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useSettingsStore.setState({
      displayMode: 'control',
      theme: 'dark',
      voiceEnabled: true,
      ttsEnabled: false,
      customPositions: [],
    });
  });

  describe('displayMode', () => {
    it('should have default displayMode as control', () => {
      expect(useSettingsStore.getState().displayMode).toBe('control');
    });

    it('should update displayMode', () => {
      useSettingsStore.getState().setDisplayMode('integrated');
      expect(useSettingsStore.getState().displayMode).toBe('integrated');
    });
  });

  describe('voice settings', () => {
    it('should have voice enabled by default', () => {
      expect(useSettingsStore.getState().voiceEnabled).toBe(true);
    });

    it('should toggle voice enabled', () => {
      useSettingsStore.getState().setVoiceEnabled(false);
      expect(useSettingsStore.getState().voiceEnabled).toBe(false);
    });

    it('should have TTS disabled by default', () => {
      expect(useSettingsStore.getState().ttsEnabled).toBe(false);
    });

    it('should toggle TTS enabled', () => {
      useSettingsStore.getState().setTtsEnabled(true);
      expect(useSettingsStore.getState().ttsEnabled).toBe(true);
    });
  });

  describe('custom positions', () => {
    it('should start with no custom positions', () => {
      expect(useSettingsStore.getState().customPositions).toHaveLength(0);
    });

    it('should add a custom position', () => {
      useSettingsStore.getState().addCustomPosition({
        name: 'workspace',
        x: 100,
        y: 200,
      });

      const positions = useSettingsStore.getState().customPositions;
      expect(positions).toHaveLength(1);
      expect(positions[0]).toEqual({ name: 'workspace', x: 100, y: 200 });
    });

    it('should update existing position with same name', () => {
      useSettingsStore.getState().addCustomPosition({ name: 'test', x: 100, y: 100 });
      useSettingsStore.getState().addCustomPosition({ name: 'test', x: 200, y: 300 });

      const positions = useSettingsStore.getState().customPositions;
      expect(positions).toHaveLength(1);
      expect(positions[0]).toEqual({ name: 'test', x: 200, y: 300 });
    });

    it('should remove a custom position', () => {
      useSettingsStore.getState().addCustomPosition({ name: 'pos1', x: 0, y: 0 });
      useSettingsStore.getState().addCustomPosition({ name: 'pos2', x: 100, y: 100 });

      useSettingsStore.getState().removeCustomPosition('pos1');

      const positions = useSettingsStore.getState().customPositions;
      expect(positions).toHaveLength(1);
      expect(positions[0].name).toBe('pos2');
    });
  });

  describe('theme', () => {
    it('should have dark theme by default', () => {
      expect(useSettingsStore.getState().theme).toBe('dark');
    });

    it('should update theme', () => {
      useSettingsStore.getState().setTheme('light');
      expect(useSettingsStore.getState().theme).toBe('light');
    });
  });
});
