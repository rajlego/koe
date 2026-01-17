import {
  getAllThoughts,
  getAllWindowStates,
  getConversationHistory,
  addThought,
  saveWindowState,
  addConversationMessage,
} from '../sync';
import type { Thought, WindowState, ConversationMessage } from '../models/types';

interface ExportData {
  version: number;
  exportedAt: string;
  thoughts: Thought[];
  windows: WindowState[];
  conversation: ConversationMessage[];
}

export function exportToJSON(): void {
  const thoughts = getAllThoughts();
  const windows = getAllWindowStates();
  const conversation = getConversationHistory();

  const data: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    thoughts,
    windows,
    conversation,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `koe-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function validateExportData(data: unknown): data is ExportData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;

  if (typeof d.version !== 'number') return false;
  if (typeof d.exportedAt !== 'string') return false;
  if (!Array.isArray(d.thoughts)) return false;
  if (!Array.isArray(d.windows)) return false;

  return true;
}

export interface ImportResult {
  thoughtsImported: number;
  windowsImported: number;
  conversationImported: number;
}

export async function importFromJSON(
  file: File,
  mode: 'merge' | 'replace'
): Promise<ImportResult> {
  const text = await file.text();
  const data = JSON.parse(text);

  if (!validateExportData(data)) {
    throw new Error('Invalid backup file format');
  }

  const result: ImportResult = {
    thoughtsImported: 0,
    windowsImported: 0,
    conversationImported: 0,
  };

  if (mode === 'replace') {
    // In replace mode, we clear existing and add all from backup
    // Note: YJS handles this as updates, not actual clearing
  }

  // Import thoughts
  const existingThoughts = new Set(getAllThoughts().map((t) => t.id));
  for (const thought of data.thoughts) {
    if (mode === 'replace' || !existingThoughts.has(thought.id)) {
      addThought(thought);
      result.thoughtsImported++;
    }
  }

  // Import windows
  const existingWindows = new Set(getAllWindowStates().map((w) => w.id));
  for (const window of data.windows) {
    if (mode === 'replace' || !existingWindows.has(window.id)) {
      saveWindowState(window);
      result.windowsImported++;
    }
  }

  // Import conversation (only in replace mode or if empty)
  if (mode === 'replace' && data.conversation) {
    for (const message of data.conversation) {
      addConversationMessage(message);
      result.conversationImported++;
    }
  }

  return result;
}

// Export just thoughts as markdown
export function exportThoughtsAsMarkdown(): void {
  const thoughts = getAllThoughts();

  const markdown = thoughts
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((t) => {
      const date = new Date(t.createdAt).toLocaleString();
      return `## ${t.type.charAt(0).toUpperCase() + t.type.slice(1)} - ${date}\n\n${t.content}\n`;
    })
    .join('\n---\n\n');

  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `koe-thoughts-${new Date().toISOString().split('T')[0]}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
