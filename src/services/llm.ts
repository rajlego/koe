import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  addThought,
  updateThought,
  getThought,
  getAllThoughts,
  deleteThought,
  addConversationMessage,
  getConversationHistory,
} from '../sync';
import { useWindows } from '../hooks/useWindows';
import { useWindowStore } from '../store/windowStore';
import { sounds } from './sounds';
import { getApiKey, useSettingsStore } from '../store/settingsStore';
import type { Thought, PositionPreset } from '../models/types';

// Get Anthropic API key from store (with env fallback)
const getAnthropicKey = () => getApiKey('anthropic');

// ============================================
// API Cost Protection: Rate Limiting & Tracking
// ============================================

// Constants for rate limiting and cost protection
const RATE_LIMIT_PER_MINUTE = 10;  // Max API calls per minute
const DEFAULT_SESSION_COST_LIMIT = 1.00;  // Default $1 limit per session
const COOLDOWN_MS = 2000;  // 2 second minimum between calls

// Estimated costs (Claude Sonnet via OpenRouter - approximate)
const COST_PER_1K_INPUT_TOKENS = 0.003;
const COST_PER_1K_OUTPUT_TOKENS = 0.015;

// Rate limiting state (module-level)
let requestTimestamps: number[] = [];
let lastRequestTime = 0;
let sessionCost = 0;
let sessionRequestCount = 0;

// Check if rate limited (more than N requests in last minute)
function isRateLimited(): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  requestTimestamps = requestTimestamps.filter(t => t > oneMinuteAgo);
  return requestTimestamps.length >= RATE_LIMIT_PER_MINUTE;
}

// Check if cooldown is active
function isCooldownActive(): boolean {
  return Date.now() - lastRequestTime < COOLDOWN_MS;
}

// Estimate cost from token counts
function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1000) * COST_PER_1K_INPUT_TOKENS +
         (outputTokens / 1000) * COST_PER_1K_OUTPUT_TOKENS;
}

// Reserve a request slot IMMEDIATELY to prevent race conditions
// Called BEFORE making the API call
function reserveRequestSlot(): void {
  const now = Date.now();
  requestTimestamps.push(now);
  lastRequestTime = now;
  sessionRequestCount++;
  console.log(`[LLM] Request slot reserved. Session: ${sessionRequestCount} requests`);
}

// Record the actual cost AFTER the API call completes
function recordRequestCost(inputTokens: number, outputTokens: number): void {
  sessionCost += estimateCost(inputTokens, outputTokens);
  console.log(`[LLM] Cost recorded: $${sessionCost.toFixed(4)} total`);
}

// Get current session stats
export function getSessionStats(): { cost: number; requests: number } {
  return { cost: sessionCost, requests: sessionRequestCount };
}

// Reset session stats (e.g., on app restart or manual reset)
export function resetSessionStats(): void {
  sessionCost = 0;
  sessionRequestCount = 0;
  requestTimestamps = [];
  lastRequestTime = 0;
  console.log('[LLM] Session stats reset');
}

// ============================================
// Security: Input Sanitization for Talon
// ============================================

// Sanitize string for safe interpolation into Python strings
// Escapes backslashes, quotes, and control characters
function sanitizeForPython(input: string): string {
  return input
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/"/g, '\\"')    // Escape double quotes
    .replace(/'/g, "\\'")    // Escape single quotes
    .replace(/\n/g, '\\n')   // Escape newlines
    .replace(/\r/g, '\\r')   // Escape carriage returns
    .replace(/\t/g, '\\t');  // Escape tabs
}

// Validate and sanitize key combinations for Talon
// Only allows alphanumeric, modifiers, and common key names
function sanitizeKeys(keys: string): string | null {
  const allowedModifiers = ['cmd', 'ctrl', 'alt', 'shift', 'super', 'win'];
  const allowedSpecialKeys = [
    'enter', 'return', 'tab', 'space', 'backspace', 'delete', 'escape', 'esc',
    'up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown',
    'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
  ];

  // Normalize and validate
  const normalized = keys.toLowerCase().trim();
  const parts = normalized.split(/[\s\-]+/);

  for (const part of parts) {
    // Check if it's a single letter/number
    if (/^[a-z0-9]$/.test(part)) continue;
    // Check if it's an allowed modifier
    if (allowedModifiers.includes(part)) continue;
    // Check if it's an allowed special key
    if (allowedSpecialKeys.includes(part)) continue;
    // Invalid key
    console.warn(`[LLM] Invalid key in combination: ${part}`);
    return null;
  }

  return keys; // Return original (preserves user's format)
}

// Sanitize app name - only alphanumeric, spaces, and basic punctuation
function sanitizeAppName(appName: string): string | null {
  // Allow letters, numbers, spaces, dots, hyphens
  if (!/^[\w\s.\-]+$/.test(appName)) {
    console.warn(`[LLM] Invalid app name: ${appName}`);
    return null;
  }
  return appName;
}

const SYSTEM_PROMPT = `You are Koe, a voice-first thinking assistant. The user speaks to you to think through problems, brainstorm, and organize their thoughts.

You have tools to manage their thinking space - a collection of thought windows they can see on screen.

IMPORTANT GUIDELINES:
1. When the user is just thinking out loud or brainstorming, create or update a thought window with their content
2. When they give commands like "put that in the corner" or "close this", use the appropriate tool
3. When they ask you to rewrite, condense, expand, or transform content, do that and show the result
4. Be concise in your responses - the user is thinking, not chatting
5. If unsure whether something is a command or content, treat it as content

WINDOW REFERENCES:
- Windows are numbered W1, W2, W3, etc. and users can see these badges
- Users can say "window 1", "window 2", "W1", "W2" to reference specific windows
- "main window" or "main" refers to the control surface (not a thought window)
- "active" or "this window" refers to the currently focused window

SPATIAL REFERENCES:
- "corner" usually means top-right
- "the side" usually means right
- "over there" often means away from center
- "this" or "that" refers to the most recently discussed or active thought
- "top right", "bottom left", etc. refer to screen positions

DICTATION MODE:
- When user says "start dictating" or "dictate mode", use set_voice_mode to enter dictation
- In dictation mode, all speech is appended directly to the target window
- User says "stop dictating", "command mode", or "hey koe" to return to command mode

WINDOW ARRANGEMENT:
- "arrange in grid" or "tile windows" triggers the arrange_windows tool
- "swap windows 1 and 2" swaps their positions
- "move window 2 to the right" moves that specific window

UNDO: When user says "undo" or "undo that", use the undo tool to revert the last change.

OS-LEVEL CONTROL (requires Talon Voice installed):
- You can control the computer beyond just Koe windows
- Use send_keys for keyboard shortcuts: "cmd-s" to save, "cmd-tab" to switch apps
- Use open_app to launch/focus applications: "open Safari", "switch to VS Code"
- Use type_text for typing longer content into other applications
- Use mouse_click for clicking (prefer keyboard when possible)
- If Talon isn't installed, inform the user they need it for OS control

Examples:
- "Save this file" → send_keys with keys "cmd-s"
- "Open Chrome" → open_app with app_name "Google Chrome"
- "Switch to Slack" → open_app with app_name "Slack"
- "Type my email address" → type_text with the text
- "Press command shift 4" → send_keys with keys "cmd-shift-4"

Current thoughts and open windows will be provided in the user message context.`;

const TOOLS = [
  {
    name: 'create_thought',
    description: 'Create a new thought window with content',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The thought content' },
        type: {
          type: 'string',
          enum: ['note', 'list', 'outline'],
          description: 'Type of thought. Use list for bullet points, outline for hierarchical, note for freeform',
        },
        position: {
          type: 'string',
          enum: ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right'],
          description: 'Where to position the window. Default is center.',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'update_thought',
    description: 'Update the content of an existing thought',
    input_schema: {
      type: 'object',
      properties: {
        thought_id: {
          type: 'string',
          description: 'ID of the thought to update. Use "active" for the currently active thought.',
        },
        content: { type: 'string', description: 'New content for the thought' },
        append: { type: 'boolean', description: 'If true, append to existing content instead of replacing' },
      },
      required: ['thought_id', 'content'],
    },
  },
  {
    name: 'move_window',
    description: 'Move a thought window to a new position',
    input_schema: {
      type: 'object',
      properties: {
        window: {
          type: 'string',
          description: 'Window to move. Can be a number (1, 2, 3), "W1"/"W2", "active", or a thought_id',
        },
        position: {
          type: 'string',
          enum: ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right'],
          description: 'New position for the window',
        },
      },
      required: ['window', 'position'],
    },
  },
  {
    name: 'close_window',
    description: 'Close a thought window',
    input_schema: {
      type: 'object',
      properties: {
        window: {
          type: 'string',
          description: 'Window to close. Can be a number (1, 2, 3), "W1"/"W2", "active", or a thought_id',
        },
      },
      required: ['window'],
    },
  },
  {
    name: 'focus_window',
    description: 'Set the active/focused window for subsequent operations',
    input_schema: {
      type: 'object',
      properties: {
        window: {
          type: 'string',
          description: 'Window to focus. Can be a number (1, 2, 3), "W1"/"W2", or a thought_id',
        },
      },
      required: ['window'],
    },
  },
  {
    name: 'set_voice_mode',
    description: 'Switch between command mode (LLM processes speech) and dictation mode (speech appends directly to a window)',
    input_schema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['command', 'dictate'],
          description: 'Voice mode: command for normal operation, dictate for continuous text input',
        },
        target_window: {
          type: 'string',
          description: 'For dictation mode: which window to append text to. Can be a number, "W1", "active", or thought_id',
        },
      },
      required: ['mode'],
    },
  },
  {
    name: 'arrange_windows',
    description: 'Automatically arrange all open windows in a layout pattern',
    input_schema: {
      type: 'object',
      properties: {
        layout: {
          type: 'string',
          enum: ['grid', 'horizontal', 'vertical', 'cascade'],
          description: 'Layout pattern: grid (tile), horizontal (side by side), vertical (stacked), cascade (overlapping)',
        },
      },
      required: ['layout'],
    },
  },
  {
    name: 'swap_windows',
    description: 'Swap the positions of two windows',
    input_schema: {
      type: 'object',
      properties: {
        window1: {
          type: 'string',
          description: 'First window. Can be a number (1, 2), "W1", or thought_id',
        },
        window2: {
          type: 'string',
          description: 'Second window. Can be a number (1, 2), "W2", or thought_id',
        },
      },
      required: ['window1', 'window2'],
    },
  },
  {
    name: 'split_content',
    description: 'Extract content from a thought and put it in a new window',
    input_schema: {
      type: 'object',
      properties: {
        source_window: {
          type: 'string',
          description: 'Source window. Can be a number, "W1", "active", or thought_id',
        },
        content_selector: {
          type: 'string',
          description: 'What to extract: "last_paragraph", "first_paragraph", "list_items", or a specific text snippet',
        },
        position: {
          type: 'string',
          enum: ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right'],
          description: 'Where to position the new window',
        },
      },
      required: ['source_window', 'content_selector'],
    },
  },
  {
    name: 'condense',
    description: 'Condense/summarize the content of a thought into a shorter version',
    input_schema: {
      type: 'object',
      properties: {
        thought_id: {
          type: 'string',
          description: 'ID of the thought to condense. Use "active" for the currently active thought.',
        },
        target: {
          type: 'string',
          enum: ['same', 'new'],
          description: 'Whether to update the same thought or create a new condensed version',
        },
      },
      required: ['thought_id'],
    },
  },
  {
    name: 'rewrite',
    description: 'Rewrite the content of a thought in a different style or tone',
    input_schema: {
      type: 'object',
      properties: {
        thought_id: {
          type: 'string',
          description: 'ID of the thought to rewrite. Use "active" for the currently active thought.',
        },
        style: {
          type: 'string',
          description: 'How to rewrite: "formal", "casual", "concise", "detailed", "bullets", "prose", or a custom instruction like "more professional" or "simpler words"',
        },
        target: {
          type: 'string',
          enum: ['same', 'new'],
          description: 'Whether to update the same thought or create a new rewritten version',
        },
      },
      required: ['thought_id', 'style'],
    },
  },
  {
    name: 'expand',
    description: 'Expand a thought with more detail or elaboration',
    input_schema: {
      type: 'object',
      properties: {
        thought_id: {
          type: 'string',
          description: 'ID of the thought to expand. Use "active" for the currently active thought.',
        },
        focus: {
          type: 'string',
          description: 'What aspect to expand on (optional). E.g., "examples", "implications", "steps"',
        },
      },
      required: ['thought_id'],
    },
  },
  {
    name: 'generate_list',
    description: 'Generate a list from the conversation or a thought',
    input_schema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'Source content to generate list from. Can be "conversation" for recent discussion, or a thought_id',
        },
        prompt: {
          type: 'string',
          description: 'What kind of list to generate (e.g., "options", "pros and cons", "next steps")',
        },
        position: {
          type: 'string',
          enum: ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right'],
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'link_thoughts',
    description: 'Create a connection between two thoughts',
    input_schema: {
      type: 'object',
      properties: {
        source_id: {
          type: 'string',
          description: 'ID of the source thought. Use "active" for the currently active thought.',
        },
        target_id: {
          type: 'string',
          description: 'ID of the thought to link to',
        },
        relationship: {
          type: 'string',
          description: 'How they relate: "supports", "contradicts", "follows", "relates to", etc.',
        },
      },
      required: ['source_id', 'target_id'],
    },
  },
  {
    name: 'undo',
    description: 'Undo the last change to thoughts',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  // OS-Level Control Tools (via Talon Voice)
  {
    name: 'send_keys',
    description: 'Send keyboard shortcuts or key sequences to the active application',
    input_schema: {
      type: 'object',
      properties: {
        keys: {
          type: 'string',
          description: 'Keys to send in Talon format (e.g., "cmd-s", "ctrl-shift-p", "cmd-tab", "enter")',
        },
      },
      required: ['keys'],
    },
  },
  {
    name: 'type_text',
    description: 'Type text as if from keyboard (for typing into other applications)',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to type',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'open_app',
    description: 'Open or switch to an application',
    input_schema: {
      type: 'object',
      properties: {
        app_name: {
          type: 'string',
          description: 'Application name (e.g., "Safari", "Google Chrome", "VS Code", "Slack")',
        },
      },
      required: ['app_name'],
    },
  },
  {
    name: 'mouse_click',
    description: 'Click the mouse at current position or specified coordinates',
    input_schema: {
      type: 'object',
      properties: {
        button: {
          type: 'string',
          enum: ['left', 'right', 'middle'],
          description: 'Mouse button to click (default: left)',
        },
        x: {
          type: 'number',
          description: 'Optional X coordinate to move to before clicking',
        },
        y: {
          type: 'number',
          description: 'Optional Y coordinate to move to before clicking',
        },
      },
    },
  },
  {
    name: 'talon_command',
    description: 'Execute a raw Talon voice command for complex actions',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Talon command to execute (e.g., "focus chrome", "go back")',
        },
      },
      required: ['command'],
    },
  },
];

interface LLMState {
  isProcessing: boolean;
  lastResponse: string | null;
  streamingText: string;
  error: string | null;
}

// Undo history
interface UndoEntry {
  type: 'create' | 'update' | 'delete';
  thoughtId: string;
  previousContent?: string;
  thought?: Thought;
}

const undoStack: UndoEntry[] = [];
const MAX_UNDO = 50;

function pushUndo(entry: UndoEntry) {
  undoStack.push(entry);
  if (undoStack.length > MAX_UNDO) {
    undoStack.shift();
  }
}

// Exported function for keyboard undo
export function performUndo(): string {
  const entry = undoStack.pop();
  if (!entry) return 'Nothing to undo';

  sounds.undo();

  switch (entry.type) {
    case 'create':
      deleteThought(entry.thoughtId);
      return 'Undid creation';

    case 'update':
      if (entry.previousContent !== undefined) {
        updateThought(entry.thoughtId, { content: entry.previousContent });
      }
      return 'Undid change';

    case 'delete':
      if (entry.thought) {
        addThought(entry.thought);
      }
      return 'Restored deleted thought';

    default:
      return 'Undo failed';
  }
}

export function canUndo(): boolean {
  return undoStack.length > 0;
}

// Helper function to transform content via Claude
async function transformContent(
  content: string,
  instruction: string,
  maxTokens = 512
): Promise<string> {
  const apiKey = getAnthropicKey();
  if (!apiKey) {
    return content;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: `${instruction}\n\nContent:\n${content}\n\nReturn ONLY the transformed text, nothing else.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error('API error');
    }

    const data = await response.json();
    return data.content[0]?.text || content;
  } catch (error) {
    console.error('Transform error:', error);
    return content;
  }
}

// Streaming response handler
type StreamCallback = (text: string, done: boolean) => void;

async function streamResponse(
  messages: Array<{ role: string; content: string }>,
  onStream: StreamCallback,
  signal: AbortSignal
): Promise<{ text: string; toolUse: Array<{ name: string; input: Record<string, unknown> }> }> {
  const apiKey = getAnthropicKey();
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      stream: true,
      messages,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let text = '';
  const toolUse: Array<{ name: string; input: Record<string, unknown> }> = [];
  let currentToolName = '';
  let currentToolInput = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);

          if (event.type === 'content_block_start') {
            if (event.content_block?.type === 'tool_use') {
              currentToolName = event.content_block.name;
              currentToolInput = '';
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta?.type === 'text_delta') {
              text += event.delta.text;
              onStream(text, false);
            } else if (event.delta?.type === 'input_json_delta') {
              currentToolInput += event.delta.partial_json;
            }
          } else if (event.type === 'content_block_stop') {
            if (currentToolName && currentToolInput) {
              try {
                toolUse.push({
                  name: currentToolName,
                  input: JSON.parse(currentToolInput),
                });
              } catch {
                // Invalid JSON, skip
              }
              currentToolName = '';
              currentToolInput = '';
            }
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  onStream(text, true);
  return { text, toolUse };
}

export function useLLM() {
  const [state, setState] = useState<LLMState>({
    isProcessing: false,
    lastResponse: null,
    streamingText: '',
    error: null,
  });

  const { createThoughtWindow, moveWindow, closeThoughtWindow } = useWindows();
  const activeThoughtId = useWindowStore((s) => s.activeThoughtId);
  const abortRef = useRef<AbortController | null>(null);

  const resolveThoughtId = useCallback(
    (thoughtId: string): string | null => {
      if (thoughtId === 'active') {
        return activeThoughtId;
      }
      return thoughtId;
    },
    [activeThoughtId]
  );

  // Resolve window reference (number, "W1", "active", or thought_id) to windowId and thoughtId
  const resolveWindowReference = useCallback(
    (ref: string): { windowId: string; thoughtId: string } | null => {
      const state = useWindowStore.getState();

      // Handle "active"
      if (ref === 'active') {
        const windowId = state.activeWindowId;
        if (!windowId) return null;
        const window = state.openWindows.get(windowId);
        if (!window) return null;
        return { windowId, thoughtId: window.thoughtId };
      }

      // Handle number or "W1" format
      const numMatch = ref.match(/^[Ww]?(\d+)$/);
      if (numMatch) {
        const displayId = parseInt(numMatch[1], 10);
        const window = state.getWindowByDisplayId(displayId);
        if (!window) return null;
        // Find windowId from the window
        for (const [wId, w] of state.openWindows) {
          if (w.thoughtId === window.thoughtId) {
            return { windowId: wId, thoughtId: window.thoughtId };
          }
        }
        return null;
      }

      // Assume it's a thought_id, find corresponding window
      for (const [windowId, window] of state.openWindows) {
        if (window.thoughtId === ref) {
          return { windowId, thoughtId: ref };
        }
      }

      return null;
    },
    []
  );

  const executeToolCall = useCallback(
    async (name: string, input: Record<string, unknown>): Promise<string> => {
      switch (name) {
        case 'create_thought': {
          const id = crypto.randomUUID();
          const thought: Thought = {
            id,
            content: input.content as string,
            type: (input.type as Thought['type']) || 'note',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
          };
          addThought(thought);
          pushUndo({ type: 'create', thoughtId: id });
          await createThoughtWindow(id, {
            position: input.position as PositionPreset,
          });
          sounds.thoughtCreated();
          return `Created thought`;
        }

        case 'update_thought': {
          const id = resolveThoughtId(input.thought_id as string);
          if (!id) return 'No active thought to update';

          const existing = getThought(id);
          if (!existing) return 'Thought not found';

          pushUndo({ type: 'update', thoughtId: id, previousContent: existing.content });

          const newContent = input.append
            ? `${existing.content}\n${input.content}`
            : (input.content as string);

          updateThought(id, { content: newContent });
          return `Updated thought`;
        }

        case 'move_window': {
          const resolved = resolveWindowReference(input.window as string);
          if (!resolved) return 'Window not found';

          await moveWindow(resolved.windowId, input.position as PositionPreset);
          sounds.windowMoved();
          const displayId = useWindowStore.getState().getDisplayId(resolved.windowId);
          return `Moved W${displayId || '?'} to ${input.position}`;
        }

        case 'close_window': {
          const resolved = resolveWindowReference(input.window as string);
          if (!resolved) return 'Window not found';

          const displayId = useWindowStore.getState().getDisplayId(resolved.windowId);
          await closeThoughtWindow(resolved.windowId);
          return `Closed W${displayId || '?'}`;
        }

        case 'focus_window': {
          const resolved = resolveWindowReference(input.window as string);
          if (!resolved) return 'Window not found';

          useWindowStore.getState().setActiveWindow(resolved.windowId);
          useWindowStore.getState().setActiveThought(resolved.thoughtId);
          const displayId = useWindowStore.getState().getDisplayId(resolved.windowId);
          return `Focused W${displayId || '?'}`;
        }

        case 'set_voice_mode': {
          const mode = input.mode as 'command' | 'dictate';
          let targetWindowId: string | null = null;

          if (mode === 'dictate' && input.target_window) {
            const resolved = resolveWindowReference(input.target_window as string);
            if (!resolved) return 'Target window not found';
            targetWindowId = resolved.windowId;
          } else if (mode === 'dictate') {
            // Default to active window
            targetWindowId = useWindowStore.getState().activeWindowId;
          }

          useWindowStore.getState().setVoiceMode(mode, targetWindowId);

          if (mode === 'dictate') {
            const displayId = targetWindowId
              ? useWindowStore.getState().getDisplayId(targetWindowId)
              : null;
            return `Dictation mode - speaking will append to W${displayId || 'active'}`;
          }
          return 'Command mode - ready for voice commands';
        }

        case 'arrange_windows': {
          const layout = input.layout as 'grid' | 'horizontal' | 'vertical' | 'cascade';
          const state = useWindowStore.getState();
          const windowIds = Array.from(state.openWindows.keys());

          if (windowIds.length === 0) return 'No windows to arrange';

          // Get screen dimensions (approximate for desktop)
          const screenWidth = 1920;
          const screenHeight = 1080;
          const padding = 50;
          const titleBarHeight = 30;

          if (layout === 'grid') {
            const cols = Math.ceil(Math.sqrt(windowIds.length));
            const rows = Math.ceil(windowIds.length / cols);
            const cellWidth = (screenWidth - padding * 2) / cols;
            const cellHeight = (screenHeight - padding * 2 - titleBarHeight) / rows;

            for (let i = 0; i < windowIds.length; i++) {
              const col = i % cols;
              const row = Math.floor(i / cols);
              const x = padding + col * cellWidth;
              const y = padding + titleBarHeight + row * cellHeight;
              state.updateWindowPosition(windowIds[i], x, y);
              state.updateWindowSize(windowIds[i], cellWidth - 10, cellHeight - 10);
            }
          } else if (layout === 'horizontal') {
            const width = (screenWidth - padding * 2) / windowIds.length;
            for (let i = 0; i < windowIds.length; i++) {
              const x = padding + i * width;
              state.updateWindowPosition(windowIds[i], x, padding + titleBarHeight);
              state.updateWindowSize(windowIds[i], width - 10, screenHeight - padding * 2 - titleBarHeight);
            }
          } else if (layout === 'vertical') {
            const height = (screenHeight - padding * 2 - titleBarHeight) / windowIds.length;
            for (let i = 0; i < windowIds.length; i++) {
              const y = padding + titleBarHeight + i * height;
              state.updateWindowPosition(windowIds[i], padding, y);
              state.updateWindowSize(windowIds[i], screenWidth - padding * 2, height - 10);
            }
          } else if (layout === 'cascade') {
            const offsetX = 30;
            const offsetY = 30;
            for (let i = 0; i < windowIds.length; i++) {
              const x = padding + i * offsetX;
              const y = padding + titleBarHeight + i * offsetY;
              state.updateWindowPosition(windowIds[i], x, y);
              state.updateWindowSize(windowIds[i], 600, 400);
            }
          }

          return `Arranged ${windowIds.length} windows in ${layout} layout`;
        }

        case 'swap_windows': {
          const resolved1 = resolveWindowReference(input.window1 as string);
          const resolved2 = resolveWindowReference(input.window2 as string);

          if (!resolved1 || !resolved2) return 'One or both windows not found';

          const state = useWindowStore.getState();
          const window1 = state.openWindows.get(resolved1.windowId);
          const window2 = state.openWindows.get(resolved2.windowId);

          if (!window1 || !window2) return 'Window state not found';

          // Swap positions
          state.updateWindowPosition(resolved1.windowId, window2.x, window2.y);
          state.updateWindowPosition(resolved2.windowId, window1.x, window1.y);

          const id1 = state.getDisplayId(resolved1.windowId);
          const id2 = state.getDisplayId(resolved2.windowId);
          return `Swapped W${id1} and W${id2}`;
        }

        case 'split_content': {
          const resolved = resolveWindowReference(input.source_window as string);
          if (!resolved) return 'Source window not found';

          const thought = getThought(resolved.thoughtId);
          if (!thought) return 'Thought not found';

          const selector = input.content_selector as string;
          let extractedContent = '';
          let remainingContent = thought.content;

          if (selector === 'last_paragraph') {
            const paragraphs = thought.content.split(/\n\n+/);
            if (paragraphs.length > 1) {
              extractedContent = paragraphs.pop() || '';
              remainingContent = paragraphs.join('\n\n');
            } else {
              return 'Only one paragraph found';
            }
          } else if (selector === 'first_paragraph') {
            const paragraphs = thought.content.split(/\n\n+/);
            if (paragraphs.length > 1) {
              extractedContent = paragraphs.shift() || '';
              remainingContent = paragraphs.join('\n\n');
            } else {
              return 'Only one paragraph found';
            }
          } else if (selector === 'list_items') {
            const lines = thought.content.split('\n');
            const listItems = lines.filter((l) => l.match(/^[-*•]\s/));
            const nonListItems = lines.filter((l) => !l.match(/^[-*•]\s/));
            if (listItems.length === 0) return 'No list items found';
            extractedContent = listItems.join('\n');
            remainingContent = nonListItems.join('\n');
          } else {
            // Treat as a text snippet to extract
            if (thought.content.includes(selector)) {
              extractedContent = selector;
              remainingContent = thought.content.replace(selector, '').trim();
            } else {
              return 'Content not found in thought';
            }
          }

          // Update source thought
          pushUndo({ type: 'update', thoughtId: resolved.thoughtId, previousContent: thought.content });
          updateThought(resolved.thoughtId, { content: remainingContent });

          // Create new thought with extracted content
          const newId = crypto.randomUUID();
          addThought({
            id: newId,
            content: extractedContent,
            type: thought.type,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
          });
          pushUndo({ type: 'create', thoughtId: newId });

          await createThoughtWindow(newId, {
            position: (input.position as PositionPreset) || 'right',
          });

          return `Split content into new window`;
        }

        case 'condense': {
          const id = resolveThoughtId(input.thought_id as string);
          if (!id) return 'No thought to condense';

          const thought = getThought(id);
          if (!thought) return 'Thought not found';

          const condensed = await transformContent(
            thought.content,
            'Condense this into a brief summary (2-3 sentences max). Preserve the key points.'
          );

          if (input.target === 'new') {
            const newId = crypto.randomUUID();
            addThought({
              id: newId,
              content: condensed,
              type: 'note',
              createdAt: new Date().toISOString(),
              modifiedAt: new Date().toISOString(),
            });
            pushUndo({ type: 'create', thoughtId: newId });
            await createThoughtWindow(newId, { position: 'top-right' });
            return 'Created condensed version';
          } else {
            pushUndo({ type: 'update', thoughtId: id, previousContent: thought.content });
            updateThought(id, { content: condensed });
            return 'Condensed thought';
          }
        }

        case 'rewrite': {
          const id = resolveThoughtId(input.thought_id as string);
          if (!id) return 'No thought to rewrite';

          const thought = getThought(id);
          if (!thought) return 'Thought not found';

          const style = input.style as string;
          let instruction = '';

          switch (style) {
            case 'formal':
              instruction = 'Rewrite this in a formal, professional tone';
              break;
            case 'casual':
              instruction = 'Rewrite this in a casual, conversational tone';
              break;
            case 'concise':
              instruction = 'Rewrite this more concisely, removing unnecessary words';
              break;
            case 'detailed':
              instruction = 'Rewrite this with more detail and explanation';
              break;
            case 'bullets':
              instruction = 'Convert this into a bullet point list';
              break;
            case 'prose':
              instruction = 'Convert this into flowing prose paragraphs';
              break;
            default:
              instruction = `Rewrite this: ${style}`;
          }

          const rewritten = await transformContent(thought.content, instruction);

          if (input.target === 'new') {
            const newId = crypto.randomUUID();
            addThought({
              id: newId,
              content: rewritten,
              type: thought.type,
              createdAt: new Date().toISOString(),
              modifiedAt: new Date().toISOString(),
            });
            pushUndo({ type: 'create', thoughtId: newId });
            await createThoughtWindow(newId, { position: 'right' });
            return 'Created rewritten version';
          } else {
            pushUndo({ type: 'update', thoughtId: id, previousContent: thought.content });
            updateThought(id, { content: rewritten });
            return 'Rewrote thought';
          }
        }

        case 'expand': {
          const id = resolveThoughtId(input.thought_id as string);
          if (!id) return 'No thought to expand';

          const thought = getThought(id);
          if (!thought) return 'Thought not found';

          const focus = input.focus ? ` Focus on: ${input.focus}` : '';
          const expanded = await transformContent(
            thought.content,
            `Expand this with more detail and elaboration.${focus}`,
            1024
          );

          pushUndo({ type: 'update', thoughtId: id, previousContent: thought.content });
          updateThought(id, { content: expanded });
          return 'Expanded thought';
        }

        case 'generate_list': {
          let sourceContent = '';
          if (input.source === 'conversation' || !input.source) {
            const history = getConversationHistory(5);
            sourceContent = history.map((m) => `${m.role}: ${m.content}`).join('\n');
          } else {
            const thought = getThought(input.source as string);
            if (thought) {
              sourceContent = thought.content;
            }
          }

          const listContent = await transformContent(
            sourceContent,
            `Generate a list for: "${input.prompt}". Return ONLY the list items, one per line, starting each with "- ".`
          );

          const id = crypto.randomUUID();
          addThought({
            id,
            content: `${input.prompt}:\n${listContent}`,
            type: 'list',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
          });
          pushUndo({ type: 'create', thoughtId: id });
          await createThoughtWindow(id, {
            position: input.position as PositionPreset,
          });
          return `Generated list`;
        }

        case 'link_thoughts': {
          const sourceId = resolveThoughtId(input.source_id as string);
          const targetId = input.target_id as string;

          if (!sourceId) return 'No source thought';

          const source = getThought(sourceId);
          const target = getThought(targetId);

          if (!source || !target) return 'Thought not found';

          const relationship = input.relationship || 'relates to';
          const linkNote = `\n\n---\n[${relationship}] ${target.content.slice(0, 50)}... (${targetId.slice(0, 8)})`;

          pushUndo({ type: 'update', thoughtId: sourceId, previousContent: source.content });
          updateThought(sourceId, { content: source.content + linkNote });

          return `Linked thoughts`;
        }

        case 'undo': {
          const entry = undoStack.pop();
          if (!entry) return 'Nothing to undo';

          sounds.undo();

          switch (entry.type) {
            case 'create':
              deleteThought(entry.thoughtId);
              // Close window if open
              const windows = useWindowStore.getState().openWindows;
              windows.forEach((w, wId) => {
                if (w.thoughtId === entry.thoughtId) {
                  closeThoughtWindow(wId);
                }
              });
              return 'Undid creation';

            case 'update':
              if (entry.previousContent !== undefined) {
                updateThought(entry.thoughtId, { content: entry.previousContent });
              }
              return 'Undid change';

            case 'delete':
              if (entry.thought) {
                addThought(entry.thought);
              }
              return 'Restored deleted thought';

            default:
              return 'Undo failed';
          }
        }

        // OS-Level Control Tools (via Talon Voice)
        // NOTE: All user inputs are sanitized to prevent Python injection
        case 'send_keys': {
          const available = await invoke<boolean>('is_talon_available');
          if (!available) {
            return 'Talon Voice not installed. Install from https://talonvoice.com for OS control.';
          }

          const rawKeys = input.keys as string;
          const keys = sanitizeKeys(rawKeys);
          if (!keys) {
            return `Invalid key combination: ${rawKeys}. Use letters, numbers, and modifiers (cmd, ctrl, alt, shift).`;
          }
          await invoke('run_talon', { code: `actions.key("${keys}")` });
          sounds.success();
          return `Sent keys: ${keys}`;
        }

        case 'type_text': {
          const available = await invoke<boolean>('is_talon_available');
          if (!available) {
            return 'Talon Voice not installed. Install from https://talonvoice.com for OS control.';
          }

          const text = sanitizeForPython(input.text as string);
          await invoke('run_talon', { code: `actions.insert("${text}")` });
          sounds.success();
          return 'Typed text';
        }

        case 'open_app': {
          const rawAppName = input.app_name as string;
          const appName = sanitizeAppName(rawAppName);
          if (!appName) {
            return `Invalid app name: ${rawAppName}. Use only letters, numbers, spaces, dots, and hyphens.`;
          }

          // Try Talon first if available
          const available = await invoke<boolean>('is_talon_available');
          if (available) {
            try {
              await invoke('run_talon', {
                code: `actions.user.switcher_focus("${sanitizeForPython(appName)}")`,
              });
              sounds.success();
              return `Switched to ${appName}`;
            } catch {
              // Fall through to macOS open command
            }
          }

          // Fallback: use macOS open command
          try {
            await invoke('open_external_url', {
              url: `file:///Applications/${encodeURIComponent(appName)}.app`,
            });
            sounds.success();
            return `Opening ${appName}`;
          } catch {
            return `Could not open ${appName}`;
          }
        }

        case 'mouse_click': {
          const available = await invoke<boolean>('is_talon_available');
          if (!available) {
            return 'Talon Voice not installed. Install from https://talonvoice.com for mouse control.';
          }

          const button = (input.button as string) === 'right' ? 1 : 0;
          const x = input.x as number | undefined;
          const y = input.y as number | undefined;

          // Validate coordinates are safe numbers
          if (x !== undefined && y !== undefined) {
            if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 10000 || y > 10000) {
              return 'Invalid mouse coordinates. Must be positive numbers within screen bounds.';
            }
            await invoke('run_talon', {
              code: `ctrl.mouse_move(${Math.round(x)}, ${Math.round(y)}); actions.mouse_click(${button})`,
            });
          } else {
            await invoke('run_talon', {
              code: `actions.mouse_click(${button})`,
            });
          }

          sounds.success();
          return `Clicked ${input.button || 'left'} button`;
        }

        case 'talon_command': {
          const available = await invoke<boolean>('is_talon_available');
          if (!available) {
            return 'Talon Voice not installed. Install from https://talonvoice.com';
          }

          const command = sanitizeForPython(input.command as string);
          await invoke('run_talon', { code: `actions.mimic("${command}")` });
          sounds.success();
          return `Executed: ${command}`;
        }

        default:
          return `Unknown tool: ${name}`;
      }
    },
    [resolveThoughtId, resolveWindowReference, createThoughtWindow, moveWindow, closeThoughtWindow]
  );

  const processTranscript = useCallback(
    async (transcript: string) => {
      // ============================================
      // API Cost Protection Checks
      // ============================================

      // Filter out test/debug transcripts
      if (transcript.includes('[AutoTest]') || transcript.includes('[Test]')) {
        console.log('[LLM] Ignoring test transcript:', transcript.slice(0, 50));
        return;
      }

      // Check cooldown (minimum time between requests)
      if (isCooldownActive()) {
        console.warn('[LLM] Cooldown active - request throttled');
        setState((s) => ({ ...s, lastResponse: 'Please wait before speaking again...' }));
        return;
      }

      // Check rate limit (max requests per minute)
      if (isRateLimited()) {
        console.warn('[LLM] Rate limit exceeded - request blocked');
        setState((s) => ({ ...s, lastResponse: `Rate limit reached (${RATE_LIMIT_PER_MINUTE}/min). Please wait.` }));
        return;
      }

      // Check session cost limit
      const costLimit = useSettingsStore.getState().apiCostLimit ?? DEFAULT_SESSION_COST_LIMIT;
      if (sessionCost >= costLimit) {
        console.warn(`[LLM] Session cost limit ($${costLimit}) reached - request blocked`);
        setState((s) => ({ ...s, lastResponse: `Session cost limit ($${costLimit.toFixed(2)}) reached. Adjust in Settings.` }));
        return;
      }

      // ============================================
      // Proceed with normal processing
      // ============================================

      // Reserve a rate limit slot IMMEDIATELY to prevent race conditions
      // This must happen before any async operations
      reserveRequestSlot();

      const apiKey = getAnthropicKey();
      if (!apiKey) {
        console.log('No API key, creating thought directly');
        const id = crypto.randomUUID();
        addThought({
          id,
          content: transcript,
          type: 'note',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
        });
        await createThoughtWindow(id);
        setState((s) => ({ ...s, lastResponse: 'Created thought (dev mode)' }));
        return;
      }

      setState((s) => ({ ...s, isProcessing: true, error: null, streamingText: '' }));

      addConversationMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: transcript,
        timestamp: new Date().toISOString(),
      });

      const thoughts = getAllThoughts();
      const history = getConversationHistory(10);
      const windowState = useWindowStore.getState();

      // Build window context
      let windowContext = '';
      if (windowState.openWindows.size > 0) {
        const windowList: string[] = [];
        windowState.openWindows.forEach((window, windowId) => {
          const displayId = windowState.windowDisplayIds.get(windowId);
          const thought = getThought(window.thoughtId);
          const isActive = windowId === windowState.activeWindowId;
          windowList.push(
            `- W${displayId}: ${thought?.content.slice(0, 40) || '(empty)'}...${isActive ? ' [ACTIVE]' : ''}`
          );
        });
        windowContext = `\nOpen windows:\n${windowList.join('\n')}`;
      }

      // Voice mode context
      const voiceModeContext =
        windowState.voiceMode === 'dictate'
          ? `\n[Voice mode: DICTATE - targeting W${windowState.getDisplayId(windowState.dictationTargetWindowId || '')}]`
          : '';

      const contextMessage =
        thoughts.length > 0
          ? `Current thoughts in workspace:\n${thoughts.map((t) => `- [${t.id.slice(0, 8)}] (${t.type}): ${t.content.slice(0, 50)}...`).join('\n')}${windowContext}${voiceModeContext}\n\nUser says: ${transcript}`
          : `${windowContext}${voiceModeContext}\n\nUser says: ${transcript}`;

      try {
        abortRef.current = new AbortController();

        const messages = [
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: contextMessage },
        ];

        const { text, toolUse } = await streamResponse(
          messages,
          (streamText, done) => {
            setState((s) => ({
              ...s,
              streamingText: streamText,
              isProcessing: !done,
            }));
          },
          abortRef.current.signal
        );

        // Record cost after API call completes
        // (Rate limit slot was already reserved before the call)
        // Estimate tokens conservatively: ~2 chars per token
        // (More conservative than typical ~4 to account for CJK, emoji, short tokens)
        const inputChars = messages.reduce((sum, m) => sum + m.content.length, 0) + SYSTEM_PROMPT.length;
        const outputChars = text.length + JSON.stringify(toolUse).length;
        const estimatedInputTokens = Math.ceil(inputChars / 2);
        const estimatedOutputTokens = Math.ceil(outputChars / 2);
        recordRequestCost(estimatedInputTokens, estimatedOutputTokens);

        // Execute tool calls
        const toolCalls = [];
        for (const tool of toolUse) {
          const result = await executeToolCall(tool.name, tool.input);
          toolCalls.push({ name: tool.name, input: tool.input, result });
        }

        // Play success sound if any tool was executed
        if (toolCalls.length > 0) {
          sounds.success();
        }

        addConversationMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: text || toolCalls.map((t) => t.result).join(', '),
          timestamp: new Date().toISOString(),
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        });

        setState({
          isProcessing: false,
          lastResponse: text || toolCalls.map((t) => t.result).join(', '),
          streamingText: '',
          error: null,
        });
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          setState((s) => ({ ...s, isProcessing: false, streamingText: '' }));
          return;
        }
        console.error('LLM error:', error);
        sounds.error();
        setState({
          isProcessing: false,
          lastResponse: null,
          streamingText: '',
          error: (error as Error).message,
        });
      }
    },
    [createThoughtWindow, executeToolCall]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    processTranscript,
    cancel,
    isProcessing: state.isProcessing,
    lastResponse: state.lastResponse,
    streamingText: state.streamingText,
    error: state.error,
  };
}
