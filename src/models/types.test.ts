import { describe, it, expect } from 'vitest';
import type {
  Thought,
  ThoughtType,
  WindowState,
  ViewMode,
  VoiceState,
  PositionPreset,
  Settings,
} from './types';

describe('types', () => {
  describe('Thought', () => {
    it('should accept valid thought object', () => {
      const thought: Thought = {
        id: 'test-id',
        content: 'Test content',
        type: 'note',
        createdAt: '2024-01-01T00:00:00.000Z',
        modifiedAt: '2024-01-01T00:00:00.000Z',
      };

      expect(thought.id).toBe('test-id');
      expect(thought.type).toBe('note');
    });

    it('should accept all thought types', () => {
      const types: ThoughtType[] = ['note', 'list', 'outline'];
      types.forEach(type => {
        const thought: Thought = {
          id: 'test',
          content: 'test',
          type,
          createdAt: '',
          modifiedAt: '',
        };
        expect(thought.type).toBe(type);
      });
    });
  });

  describe('WindowState', () => {
    it('should accept valid window state', () => {
      const window: WindowState = {
        id: 'window-1',
        thoughtId: 'thought-1',
        x: 100,
        y: 200,
        width: 400,
        height: 300,
        viewMode: 'full',
      };

      expect(window.x).toBe(100);
      expect(window.viewMode).toBe('full');
    });

    it('should accept all view modes', () => {
      const modes: ViewMode[] = ['full', 'condensed', 'title-only'];
      modes.forEach(mode => {
        const window: WindowState = {
          id: 'test',
          thoughtId: 'test',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          viewMode: mode,
        };
        expect(window.viewMode).toBe(mode);
      });
    });
  });

  describe('VoiceState', () => {
    it('should accept all voice states', () => {
      const states: VoiceState[] = ['idle', 'listening', 'processing', 'error'];
      states.forEach(state => {
        const voiceState: VoiceState = state;
        expect(voiceState).toBe(state);
      });
    });
  });

  describe('PositionPreset', () => {
    it('should accept all position presets', () => {
      const presets: PositionPreset[] = [
        'center',
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
        'left',
        'right',
      ];
      presets.forEach(preset => {
        const position: PositionPreset = preset;
        expect(position).toBe(preset);
      });
    });
  });

  describe('Settings', () => {
    it('should accept valid settings object', () => {
      const settings: Settings = {
        displayMode: 'control',
        voiceEnabled: true,
        ttsEnabled: false,
        customPositions: [{ name: 'test', x: 100, y: 200 }],
        theme: 'dark',
      };

      expect(settings.displayMode).toBe('control');
      expect(settings.customPositions).toHaveLength(1);
    });
  });
});
