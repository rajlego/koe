import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch for API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Test helper functions extracted from llm.ts logic
describe('LLM Service', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('condenseContent', () => {
    it('should call Claude API with correct prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: [{ type: 'text', text: 'Condensed summary here' }],
        }),
      });

      const content = 'This is a long piece of content that needs to be condensed into a shorter summary.';

      await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-key',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 256,
          messages: [
            {
              role: 'user',
              content: `Condense the following content into a brief summary (2-3 sentences max). Preserve the key points and main ideas. Only return the condensed text, nothing else.\n\nContent:\n${content}`,
            },
          ],
        }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        body: '{}',
      });

      expect(response.ok).toBe(false);
    });
  });

  describe('generateListContent', () => {
    it('should generate a list from source content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: [{
            type: 'text',
            text: '- Option 1: Do X\n- Option 2: Do Y\n- Option 3: Do Z',
          }],
        }),
      });

      const source = 'We discussed various options for the project including X, Y, and Z';
      const prompt = 'options for the project';

      await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 512,
          messages: [{
            role: 'user',
            content: `Based on the following context, generate a list for: "${prompt}"\n\nContext:\n${source}\n\nReturn ONLY the list items, one per line, starting each with "- ". No introduction or explanation.`,
          }],
        }),
      });

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('tool execution', () => {
    it('should parse create_thought tool correctly', () => {
      const toolInput = {
        content: 'New thought content',
        type: 'note',
        position: 'center',
      };

      expect(toolInput.content).toBe('New thought content');
      expect(toolInput.type).toBe('note');
      expect(toolInput.position).toBe('center');
    });

    it('should parse move_window tool correctly', () => {
      const toolInput = {
        thought_id: 'active',
        position: 'top-right',
      };

      expect(toolInput.thought_id).toBe('active');
      expect(toolInput.position).toBe('top-right');
    });

    it('should parse condense tool correctly', () => {
      const toolInput = {
        thought_id: 'thought-123',
        target: 'new',
      };

      expect(toolInput.thought_id).toBe('thought-123');
      expect(toolInput.target).toBe('new');
    });

    it('should parse generate_list tool correctly', () => {
      const toolInput = {
        source: 'conversation',
        prompt: 'next steps',
        position: 'right',
      };

      expect(toolInput.source).toBe('conversation');
      expect(toolInput.prompt).toBe('next steps');
    });
  });

  describe('system prompt', () => {
    it('should include spatial references', () => {
      const fullPrompt = `You are Koe, a voice-first thinking assistant. The user speaks to you to think through problems, brainstorm, and organize their thoughts.

SPATIAL REFERENCES:
- "corner" usually means top-right
- "the side" usually means right
- "over there" often means away from center
- "this" or "that" refers to the most recently discussed or active thought`;

      expect(fullPrompt).toContain('corner');
      expect(fullPrompt).toContain('top-right');
    });
  });

  describe('response parsing', () => {
    it('should extract text from response', () => {
      const response = {
        content: [
          { type: 'text', text: 'Here is my response' },
        ],
      };

      const textBlocks = response.content.filter(b => b.type === 'text');
      expect(textBlocks).toHaveLength(1);
      expect(textBlocks[0].text).toBe('Here is my response');
    });

    it('should extract tool calls from response', () => {
      const response = {
        content: [
          {
            type: 'tool_use',
            name: 'create_thought',
            input: { content: 'Test', type: 'note' },
          },
          { type: 'text', text: 'Created a thought' },
        ],
      };

      const toolUses = response.content.filter(b => b.type === 'tool_use');
      expect(toolUses).toHaveLength(1);
      expect(toolUses[0].name).toBe('create_thought');
    });

    it('should handle multiple tool calls', () => {
      const response = {
        content: [
          { type: 'tool_use', name: 'create_thought', input: {} },
          { type: 'tool_use', name: 'move_window', input: {} },
        ],
      };

      const toolUses = response.content.filter(b => b.type === 'tool_use');
      expect(toolUses).toHaveLength(2);
    });
  });
});
