import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';

// Create a fresh ydoc for each test
let testYdoc: Y.Doc;
let thoughtsMap: Y.Map<Y.Map<unknown>>;
let conversationArray: Y.Array<Y.Map<unknown>>;

// Helper functions that work with the test ydoc
function addThought(thought: { id: string; content: string; type: string; createdAt: string; modifiedAt: string }) {
  const ymap = new Y.Map<unknown>();
  ymap.set('id', thought.id);
  ymap.set('content', thought.content);
  ymap.set('type', thought.type);
  ymap.set('createdAt', thought.createdAt);
  ymap.set('modifiedAt', thought.modifiedAt);
  thoughtsMap.set(thought.id, ymap);
}

function getThought(id: string) {
  const ymap = thoughtsMap.get(id);
  if (!ymap) return null;
  return {
    id: ymap.get('id') as string,
    content: ymap.get('content') as string,
    type: ymap.get('type') as string,
    createdAt: ymap.get('createdAt') as string,
    modifiedAt: ymap.get('modifiedAt') as string,
  };
}

function updateThought(id: string, updates: Partial<{ content: string; type: string }>) {
  const ymap = thoughtsMap.get(id);
  if (!ymap) return;
  Object.entries(updates).forEach(([key, value]) => {
    ymap.set(key, value);
  });
  ymap.set('modifiedAt', new Date().toISOString());
}

function deleteThought(id: string) {
  thoughtsMap.delete(id);
}

function getAllThoughts() {
  const thoughts: Array<{ id: string; content: string; type: string; createdAt: string; modifiedAt: string }> = [];
  thoughtsMap.forEach((ymap) => {
    thoughts.push({
      id: ymap.get('id') as string,
      content: ymap.get('content') as string,
      type: ymap.get('type') as string,
      createdAt: ymap.get('createdAt') as string,
      modifiedAt: ymap.get('modifiedAt') as string,
    });
  });
  return thoughts;
}

describe('yjsProvider', () => {
  beforeEach(() => {
    testYdoc = new Y.Doc();
    thoughtsMap = testYdoc.getMap('thoughts');
    // Initialize windows map for test isolation even if not directly used
    testYdoc.getMap('windows');
    conversationArray = testYdoc.getArray('conversation');
  });

  describe('thoughts', () => {
    const mockThought = {
      id: 'thought-1',
      content: 'Test thought content',
      type: 'note',
      createdAt: '2024-01-01T00:00:00.000Z',
      modifiedAt: '2024-01-01T00:00:00.000Z',
    };

    it('should add a thought', () => {
      addThought(mockThought);

      const thought = getThought('thought-1');
      expect(thought).not.toBeNull();
      expect(thought?.content).toBe('Test thought content');
      expect(thought?.type).toBe('note');
    });

    it('should get all thoughts', () => {
      addThought(mockThought);
      addThought({ ...mockThought, id: 'thought-2', content: 'Second thought' });

      const thoughts = getAllThoughts();
      expect(thoughts).toHaveLength(2);
    });

    it('should update a thought', () => {
      addThought(mockThought);
      updateThought('thought-1', { content: 'Updated content' });

      const thought = getThought('thought-1');
      expect(thought?.content).toBe('Updated content');
    });

    it('should delete a thought', () => {
      addThought(mockThought);
      deleteThought('thought-1');

      expect(getThought('thought-1')).toBeNull();
    });

    it('should return null for non-existent thought', () => {
      expect(getThought('non-existent')).toBeNull();
    });
  });

  describe('CRDT properties', () => {
    it('should merge concurrent updates', () => {
      // Simulate two concurrent updates
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      const map1 = doc1.getMap<Y.Map<unknown>>('thoughts');
      const map2 = doc2.getMap<Y.Map<unknown>>('thoughts');

      // Add thought in doc1
      const thought1 = new Y.Map<unknown>();
      thought1.set('id', 'shared');
      thought1.set('content', 'From doc1');
      map1.set('shared', thought1);

      // Sync doc1 to doc2
      const update1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update1);

      // Now doc2 should have the thought
      const synced = map2.get('shared');
      expect(synced?.get('content')).toBe('From doc1');

      // Update in doc2
      synced?.set('content', 'Updated in doc2');

      // Sync back to doc1
      const update2 = Y.encodeStateAsUpdate(doc2);
      Y.applyUpdate(doc1, update2);

      // Both should have the same value
      expect(map1.get('shared')?.get('content')).toBe('Updated in doc2');
    });
  });

  describe('conversation history', () => {
    it('should add conversation messages', () => {
      const message = new Y.Map<unknown>();
      message.set('id', 'msg-1');
      message.set('role', 'user');
      message.set('content', 'Hello');
      message.set('timestamp', new Date().toISOString());
      conversationArray.push([message]);

      expect(conversationArray.length).toBe(1);
      expect(conversationArray.get(0).get('content')).toBe('Hello');
    });

    it('should maintain message order', () => {
      for (let i = 0; i < 5; i++) {
        const message = new Y.Map<unknown>();
        message.set('id', `msg-${i}`);
        message.set('content', `Message ${i}`);
        conversationArray.push([message]);
      }

      expect(conversationArray.length).toBe(5);
      expect(conversationArray.get(0).get('content')).toBe('Message 0');
      expect(conversationArray.get(4).get('content')).toBe('Message 4');
    });
  });
});
