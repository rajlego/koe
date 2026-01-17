import { useCallback } from 'react';
import { useWindows } from '../../hooks/useWindows';
import type { Thought } from '../../models/types';
import './ThoughtHistory.css';

interface ThoughtHistoryProps {
  thoughts: Thought[];
  onClose: () => void;
}

export default function ThoughtHistory({ thoughts, onClose }: ThoughtHistoryProps) {
  const { createThoughtWindow } = useWindows();

  const handleOpenThought = useCallback(
    (thoughtId: string) => {
      createThoughtWindow(thoughtId);
    },
    [createThoughtWindow]
  );

  // Group thoughts by date
  const groupedThoughts = groupByDate(thoughts);

  return (
    <div className="thought-history-overlay">
      <div className="thought-history">
        <header className="history-header">
          <h2>Thought History</h2>
          <button className="close-btn" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <div className="history-content">
          {Object.entries(groupedThoughts).map(([date, dateThoughts]) => (
            <section key={date} className="history-section">
              <h3 className="history-date">{date}</h3>
              <ul className="history-list">
                {dateThoughts.map((thought) => (
                  <li key={thought.id} className="history-item">
                    <button
                      className="history-item-btn"
                      onClick={() => handleOpenThought(thought.id)}
                    >
                      <div className="history-item-header">
                        <span className="history-type">{thought.type}</span>
                        <span className="history-time">
                          {formatTime(thought.createdAt)}
                        </span>
                      </div>
                      <p className="history-preview">{thought.content}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {thoughts.length === 0 && (
            <div className="history-empty">
              <p>No thoughts yet. Start speaking to create your first thought.</p>
            </div>
          )}
        </div>

        <footer className="history-footer">
          <span className="history-count">
            {thoughts.length} thought{thoughts.length !== 1 ? 's' : ''}
          </span>
        </footer>
      </div>
    </div>
  );
}

function groupByDate(thoughts: Thought[]): Record<string, Thought[]> {
  const groups: Record<string, Thought[]> = {};

  // Sort by most recent first
  const sorted = [...thoughts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  for (const thought of sorted) {
    const date = formatDate(thought.createdAt);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(thought);
  }

  return groups;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 1l12 12M1 13L13 1" />
    </svg>
  );
}
