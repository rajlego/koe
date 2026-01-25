// Core data types for Koe

export interface Thought {
  id: string;
  content: string;
  type: ThoughtType;
  tags?: string[];
  order?: number; // For manual ordering in the list (lower = higher priority)
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
  displayId?: number; // W1, W2, etc. for voice reference
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

// Image Generation Types
export type ImageProvider = 'openai' | 'stability' | 'replicate' | 'fal';

export type ImageSize = '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024';

export type ImageStyle = 'vivid' | 'natural';

export type ImageQuality = 'standard' | 'hd';

export interface ImageGenerationConfig {
  provider: ImageProvider;
  model?: string;
  size?: ImageSize;
  style?: ImageStyle;
  quality?: ImageQuality;
}

export interface GeneratedImage {
  id: string;
  prompt: string;
  url?: string;
  base64?: string;
  provider: ImageProvider;
  model: string;
  createdAt: string;
  cached: boolean;
}

export interface ImageCacheEntry {
  id: string;
  promptHash: string;
  base64: string;
  provider: ImageProvider;
  model: string;
  createdAt: string;
  expiresAt: string;
}
