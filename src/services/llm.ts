import { useState, useCallback, useRef } from 'react';
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
import { getApiKey } from '../store/settingsStore';
import type { Thought, PositionPreset } from '../models/types';

// Get Anthropic API key from store (with env fallback)
const getAnthropicKey = () => getApiKey('anthropic');

const SYSTEM_PROMPT = `You are Koe, a voice-first thinking assistant. The user speaks to you to think through problems, brainstorm, and organize their thoughts.

You have tools to manage their thinking space - a collection of thought windows they can see on screen.

IMPORTANT GUIDELINES:
1. When the user is just thinking out loud or brainstorming, create or update a thought window with their content
2. When they give commands like "put that in the corner" or "close this", use the appropriate tool
3. When they ask you to rewrite, condense, expand, or transform content, do that and show the result
4. Be concise in your responses - the user is thinking, not chatting
5. If unsure whether something is a command or content, treat it as content

SPATIAL REFERENCES:
- "corner" usually means top-right
- "the side" usually means right
- "over there" often means away from center
- "this" or "that" refers to the most recently discussed or active thought

UNDO: When user says "undo" or "undo that", use the undo tool to revert the last change.

Current thoughts in the workspace will be provided in the user message context.`;

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
        thought_id: {
          type: 'string',
          description: 'ID of the thought to move. Use "active" for the currently active thought.',
        },
        position: {
          type: 'string',
          enum: ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right'],
          description: 'New position for the window',
        },
      },
      required: ['thought_id', 'position'],
    },
  },
  {
    name: 'close_window',
    description: 'Close a thought window',
    input_schema: {
      type: 'object',
      properties: {
        thought_id: {
          type: 'string',
          description: 'ID of the thought window to close. Use "active" for the currently active thought.',
        },
      },
      required: ['thought_id'],
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
          const id = resolveThoughtId(input.thought_id as string);
          if (!id) return 'No active thought to move';

          const windows = useWindowStore.getState().openWindows;
          let windowId: string | null = null;
          windows.forEach((w, wId) => {
            if (w.thoughtId === id) windowId = wId;
          });

          if (windowId) {
            await moveWindow(windowId, input.position as PositionPreset);
            sounds.windowMoved();
            return `Moved to ${input.position}`;
          }
          return 'Window not found';
        }

        case 'close_window': {
          const id = resolveThoughtId(input.thought_id as string);
          if (!id) return 'No active thought to close';

          const windows = useWindowStore.getState().openWindows;
          let windowId: string | null = null;
          windows.forEach((w, wId) => {
            if (w.thoughtId === id) windowId = wId;
          });

          if (windowId) {
            await closeThoughtWindow(windowId);
            return 'Closed window';
          }
          return 'Window not found';
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

        default:
          return `Unknown tool: ${name}`;
      }
    },
    [resolveThoughtId, createThoughtWindow, moveWindow, closeThoughtWindow]
  );

  const processTranscript = useCallback(
    async (transcript: string) => {
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

      const contextMessage =
        thoughts.length > 0
          ? `Current thoughts in workspace:\n${thoughts.map((t) => `- [${t.id.slice(0, 8)}] (${t.type}): ${t.content.slice(0, 50)}...`).join('\n')}\n\nUser says: ${transcript}`
          : transcript;

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
