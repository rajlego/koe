import { useCallback } from 'react';
import { useWindows } from '../../hooks/useWindows';
import type { Thought } from '../../models/types';
import './ThoughtList.css';

interface ThoughtListProps {
  thoughts: Thought[];
}

export default function ThoughtList({ thoughts }: ThoughtListProps) {
  const { createThoughtWindow } = useWindows();

  const handleOpenThought = useCallback(
    (thoughtId: string) => {
      createThoughtWindow(thoughtId);
    },
    [createThoughtWindow]
  );

  if (thoughts.length === 0) {
    return (
      <div className="thought-list-empty">
        <p>No thoughts yet. Start speaking to create one.</p>
      </div>
    );
  }

  // Sort by most recent
  const sortedThoughts = [...thoughts].sort(
    (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
  );

  return (
    <ul className="thought-list-container">
      {sortedThoughts.map((thought) => (
        <li key={thought.id} className="thought-list-item">
          <button
            className="thought-list-button"
            onClick={() => handleOpenThought(thought.id)}
          >
            <span className="thought-type-badge">{thought.type}</span>
            <span className="thought-preview">
              {thought.content.slice(0, 50)}
              {thought.content.length > 50 ? '...' : ''}
            </span>
            <span className="thought-time">
              {formatRelativeTime(thought.modifiedAt)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
