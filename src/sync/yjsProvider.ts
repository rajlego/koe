import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { Thought, WindowState, ConversationMessage } from '../models/types';

// Yjs document - single source of truth for all synced data
export const ydoc = new Y.Doc();

// IndexedDB persistence for offline-first
let persistence: IndexeddbPersistence | null = null;

// Initialize local persistence
export function initLocalPersistence(docName: string = 'koe-data'): Promise<void> {
  return new Promise((resolve) => {
    persistence = new IndexeddbPersistence(docName, ydoc);
    persistence.on('synced', () => {
      console.log('Yjs: Local data loaded from IndexedDB');
      resolve();
    });
  });
}

// === Thoughts ===

export function getThoughtsMap(): Y.Map<Y.Map<unknown>> {
  return ydoc.getMap('thoughts');
}

export function yMapToThought(ymap: Y.Map<unknown>): Thought {
  return {
    id: ymap.get('id') as string,
    content: ymap.get('content') as string,
    type: ymap.get('type') as Thought['type'],
    tags: ymap.get('tags') as string[] | undefined,
    order: ymap.get('order') as number | undefined,
    createdAt: ymap.get('createdAt') as string,
    modifiedAt: ymap.get('modifiedAt') as string,
  };
}

export function addThought(thought: Thought): void {
  const thoughtsMap = getThoughtsMap();
  const ymap = new Y.Map<unknown>();
  ymap.set('id', thought.id);
  ymap.set('content', thought.content);
  ymap.set('type', thought.type);
  if (thought.tags) {
    ymap.set('tags', thought.tags);
  }
  // Set order to 0 for new thoughts (they appear at top), or use provided order
  ymap.set('order', thought.order ?? 0);
  ymap.set('createdAt', thought.createdAt);
  ymap.set('modifiedAt', thought.modifiedAt);
  thoughtsMap.set(thought.id, ymap);
}

export function updateThought(thoughtId: string, updates: Partial<Thought>): void {
  const thoughtsMap = getThoughtsMap();
  const ymap = thoughtsMap.get(thoughtId);
  if (!ymap) return;

  Object.entries(updates).forEach(([key, value]) => {
    ymap.set(key, value);
  });
  ymap.set('modifiedAt', new Date().toISOString());
}

export function deleteThought(thoughtId: string): void {
  const thoughtsMap = getThoughtsMap();
  thoughtsMap.delete(thoughtId);
}

/**
 * Reorder thoughts by updating their order values.
 * @param orderedIds - Array of thought IDs in the desired order (first = lowest order value)
 */
export function reorderThoughts(orderedIds: string[]): void {
  const thoughtsMap = getThoughtsMap();

  // Use a transaction to batch all updates
  ydoc.transact(() => {
    orderedIds.forEach((id, index) => {
      const ymap = thoughtsMap.get(id);
      if (ymap) {
        ymap.set('order', index);
      }
    });
  });
}

export function getThought(thoughtId: string): Thought | null {
  const thoughtsMap = getThoughtsMap();
  const ymap = thoughtsMap.get(thoughtId);
  if (!ymap) return null;
  return yMapToThought(ymap);
}

export function getAllThoughts(): Thought[] {
  const thoughtsMap = getThoughtsMap();
  const thoughts: Thought[] = [];
  thoughtsMap.forEach((ymap) => {
    thoughts.push(yMapToThought(ymap));
  });
  return thoughts;
}

export function onThoughtsChange(callback: (thoughts: Thought[]) => void): () => void {
  const thoughtsMap = getThoughtsMap();
  const handler = () => callback(getAllThoughts());
  thoughtsMap.observeDeep(handler);
  return () => thoughtsMap.unobserveDeep(handler);
}

// === Windows ===

export function getWindowsMap(): Y.Map<Y.Map<unknown>> {
  return ydoc.getMap('windows');
}

export function yMapToWindow(ymap: Y.Map<unknown>): WindowState {
  return {
    id: ymap.get('id') as string,
    thoughtId: ymap.get('thoughtId') as string,
    x: ymap.get('x') as number,
    y: ymap.get('y') as number,
    width: ymap.get('width') as number,
    height: ymap.get('height') as number,
    viewMode: ymap.get('viewMode') as WindowState['viewMode'],
  };
}

export function saveWindowState(window: WindowState): void {
  const windowsMap = getWindowsMap();
  const ymap = new Y.Map<unknown>();
  ymap.set('id', window.id);
  ymap.set('thoughtId', window.thoughtId);
  ymap.set('x', window.x);
  ymap.set('y', window.y);
  ymap.set('width', window.width);
  ymap.set('height', window.height);
  ymap.set('viewMode', window.viewMode);
  windowsMap.set(window.id, ymap);
}

export function removeWindowState(windowId: string): void {
  const windowsMap = getWindowsMap();
  windowsMap.delete(windowId);
}

export function getAllWindowStates(): WindowState[] {
  const windowsMap = getWindowsMap();
  const windows: WindowState[] = [];
  windowsMap.forEach((ymap) => {
    windows.push(yMapToWindow(ymap));
  });
  return windows;
}

// === Conversation History ===

export function getConversationArray(): Y.Array<Y.Map<unknown>> {
  return ydoc.getArray('conversation');
}

export function addConversationMessage(message: ConversationMessage): void {
  const conversationArray = getConversationArray();
  const ymap = new Y.Map<unknown>();
  ymap.set('id', message.id);
  ymap.set('role', message.role);
  ymap.set('content', message.content);
  ymap.set('timestamp', message.timestamp);
  if (message.toolCalls) {
    ymap.set('toolCalls', message.toolCalls);
  }
  conversationArray.push([ymap]);
}

export function getConversationHistory(limit?: number): ConversationMessage[] {
  const conversationArray = getConversationArray();
  const messages: ConversationMessage[] = [];

  const start = limit ? Math.max(0, conversationArray.length - limit) : 0;
  for (let i = start; i < conversationArray.length; i++) {
    const ymap = conversationArray.get(i);
    messages.push({
      id: ymap.get('id') as string,
      role: ymap.get('role') as 'user' | 'assistant',
      content: ymap.get('content') as string,
      timestamp: ymap.get('timestamp') as string,
      toolCalls: ymap.get('toolCalls') as ConversationMessage['toolCalls'],
    });
  }
  return messages;
}

export function clearConversationHistory(): void {
  const conversationArray = getConversationArray();
  conversationArray.delete(0, conversationArray.length);
}

// === Cleanup ===

export function getSyncStatus(): 'synced' | 'syncing' | 'offline' {
  return persistence ? 'synced' : 'offline';
}

export function destroy(): void {
  if (persistence) {
    persistence.destroy();
    persistence = null;
  }
  ydoc.destroy();
}
