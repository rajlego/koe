// Core data types for Koe

export interface Thought {
  id: string;
  content: string;
  type: ThoughtType;
  tags?: string[];
  createdAt: string;
  modifiedAt: string;
}

export type ThoughtType = 'note' | 'list' | 'outline';

export interface WindowState {
  id: string;
  thoughtId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  viewMode: ViewMode;
}

export type ViewMode = 'full' | 'condensed' | 'title-only';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
}

// Voice states
export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

// Position presets
export type PositionPreset =
  | 'center'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'left'
  | 'right';

export interface CustomPosition {
  name: string;
  x: number;
  y: number;
}

// Settings
export interface Settings {
  displayMode: 'control' | 'integrated';
  voiceEnabled: boolean;
  ttsEnabled: boolean;
  customPositions: CustomPosition[];
  theme: 'dark' | 'light';
}

// LLM Tool definitions
export interface LLMTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}
