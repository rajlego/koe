import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getThought, updateThought, onThoughtsChange } from '../../sync';
import { useWindowStore } from '../../store/windowStore';
import { useWindowTracking } from '../../hooks/useWindowRestore';
import type { Thought } from '../../models/types';
import VoiceIndicator from '../common/VoiceIndicator';
import MarkdownRenderer from '../common/MarkdownRenderer';
import TagInput, { TagList } from '../common/TagInput';
import './ThoughtWindow.css';

interface ThoughtWindowProps {
  thoughtId?: string;
  isMainWindow?: boolean;
}

export default function ThoughtWindow({ thoughtId: propThoughtId, isMainWindow }: ThoughtWindowProps) {
  const params = useParams<{ thoughtId: string }>();
  const thoughtId = propThoughtId ?? params.thoughtId;

  const [thought, setThought] = useState<Thought | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [windowLabel, setWindowLabel] = useState<string | null>(null);
  const voiceState = useWindowStore((s) => s.voiceState);

  // Get window label for tracking
  useEffect(() => {
    if (isMainWindow) return;
    const win = getCurrentWindow();
    setWindowLabel(win.label);
  }, [isMainWindow]);

  // Track window position and size changes
  useWindowTracking(isMainWindow ? null : windowLabel);

  // Load thought
  useEffect(() => {
    if (!thoughtId) return;

    const loadThought = () => {
      const t = getThought(thoughtId);
      setThought(t);
      if (t) {
        setEditContent(t.content);
        setEditTags(t.tags || []);
      }
    };

    loadThought();

    // Subscribe to changes
    const unsubscribe = onThoughtsChange(() => loadThought());
    return unsubscribe;
  }, [thoughtId]);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!thoughtId || !thought) return;
    updateThought(thoughtId, { content: editContent, tags: editTags });
    setIsEditing(false);
  }, [thoughtId, thought, editContent, editTags]);

  const handleCancelEdit = useCallback(() => {
    setEditContent(thought?.content ?? '');
    setEditTags(thought?.tags || []);
    setIsEditing(false);
  }, [thought]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancelEdit();
      } else if (e.key === 'Enter' && e.metaKey) {
        handleSaveEdit();
      }
    },
    [handleCancelEdit, handleSaveEdit]
  );

  if (!thought) {
    return (
      <div className="thought-window empty">
        <p>Thought not found</p>
      </div>
    );
  }

  return (
    <div className={`thought-window ${isMainWindow ? 'main-window' : ''}`}>
      {isMainWindow && (
        <header className="thought-header">
          <VoiceIndicator state={voiceState} size="small" />
        </header>
      )}

      <div className="thought-content">
        {isEditing ? (
          <>
            <textarea
              className="thought-editor"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <div className="thought-tags-edit">
              <TagInput tags={editTags} onChange={setEditTags} placeholder="Add tags..." />
            </div>
          </>
        ) : (
          <div
            className="thought-display"
            onClick={handleStartEdit}
            role="button"
            tabIndex={0}
          >
            <MarkdownRenderer content={thought.content} />
            {thought.tags && thought.tags.length > 0 && (
              <div className="thought-tags">
                <TagList tags={thought.tags} />
              </div>
            )}
          </div>
        )}
      </div>

      {isEditing && (
        <footer className="thought-footer">
          <button onClick={handleCancelEdit} className="btn-cancel">
            Cancel
          </button>
          <button onClick={handleSaveEdit} className="btn-save">
            Save
          </button>
        </footer>
      )}
    </div>
  );
}
