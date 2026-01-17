import { useCallback, useState, useEffect, useRef, useMemo, DragEvent } from 'react';
import { useWindows } from '../../hooks/useWindows';
import { reorderThoughts } from '../../sync/yjsProvider';
import type { Thought } from '../../models/types';
import './ThoughtList.css';

interface ThoughtListProps {
  thoughts: Thought[];
}

export default function ThoughtList({ thoughts }: ThoughtListProps) {
  const { createThoughtWindow } = useWindows();
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);
  const containerRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const handleOpenThought = useCallback(
    (thoughtId: string) => {
      createThoughtWindow(thoughtId);
    },
    [createThoughtWindow]
  );

  // Sort by order (if set), then by most recent
  const sortedThoughts = useMemo(
    () =>
      [...thoughts].sort((a, b) => {
        // If both have order, sort by order (ascending)
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        // If only one has order, it comes first
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        // Fallback to most recent
        return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
      }),
    [thoughts]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if container or its children are focused
      if (!containerRef.current?.contains(document.activeElement)) {
        return;
      }

      if (sortedThoughts.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev < sortedThoughts.length - 1 ? prev + 1 : 0;
            return next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev > 0 ? prev - 1 : sortedThoughts.length - 1;
            return next;
          });
          break;
        case 'Enter':
          if (focusedIndex >= 0 && focusedIndex < sortedThoughts.length) {
            e.preventDefault();
            handleOpenThought(sortedThoughts[focusedIndex].id);
          }
          break;
        case 'Escape':
          setFocusedIndex(-1);
          containerRef.current?.focus();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sortedThoughts, focusedIndex, handleOpenThought]);

  // Focus the item when focusedIndex changes
  useEffect(() => {
    if (focusedIndex >= 0) {
      const button = itemRefs.current.get(focusedIndex);
      button?.focus();
    }
  }, [focusedIndex]);

  // Reset focus when thoughts change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [thoughts.length]);

  const setItemRef = useCallback((index: number, el: HTMLButtonElement | null) => {
    if (el) {
      itemRefs.current.set(index, el);
    } else {
      itemRefs.current.delete(index);
    }
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback(
    (e: DragEvent<HTMLLIElement>, thoughtId: string) => {
      setDraggedId(thoughtId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', thoughtId);

      // Add a slight delay to allow the drag image to be set
      requestAnimationFrame(() => {
        const target = e.currentTarget;
        target.classList.add('dragging');
      });
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
    setDragOverPosition(null);

    // Remove dragging class from all items
    const items = containerRef.current?.querySelectorAll('.thought-list-item');
    items?.forEach((item) => item.classList.remove('dragging'));
  }, []);

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLLIElement>, thoughtId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (thoughtId === draggedId) {
        setDragOverId(null);
        setDragOverPosition(null);
        return;
      }

      // Determine if we're in the top or bottom half of the element
      const rect = e.currentTarget.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const position = e.clientY < midpoint ? 'before' : 'after';

      setDragOverId(thoughtId);
      setDragOverPosition(position);
    },
    [draggedId]
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLLIElement>) => {
    // Only clear if we're actually leaving the element (not entering a child)
    const relatedTarget = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverId(null);
      setDragOverPosition(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLLIElement>, targetId: string) => {
      e.preventDefault();

      const sourceId = e.dataTransfer.getData('text/plain');
      if (!sourceId || sourceId === targetId) {
        handleDragEnd();
        return;
      }

      // Calculate the new order
      const currentIds = sortedThoughts.map((t) => t.id);
      const sourceIndex = currentIds.indexOf(sourceId);
      let targetIndex = currentIds.indexOf(targetId);

      if (sourceIndex === -1 || targetIndex === -1) {
        handleDragEnd();
        return;
      }

      // Remove source from current position
      currentIds.splice(sourceIndex, 1);

      // Recalculate target index after removal
      targetIndex = currentIds.indexOf(targetId);

      // Insert at new position based on drop position
      if (dragOverPosition === 'after') {
        currentIds.splice(targetIndex + 1, 0, sourceId);
      } else {
        currentIds.splice(targetIndex, 0, sourceId);
      }

      // Persist the new order
      reorderThoughts(currentIds);

      handleDragEnd();
    },
    [sortedThoughts, dragOverPosition, handleDragEnd]
  );

  if (thoughts.length === 0) {
    return (
      <div className="thought-list-empty">
        <p>No thoughts yet. Start speaking to create one.</p>
      </div>
    );
  }

  // Build class names for drag state
  const getItemClassName = (thoughtId: string) => {
    const classes = ['thought-list-item'];
    if (draggedId === thoughtId) {
      classes.push('dragging');
    }
    if (dragOverId === thoughtId) {
      classes.push('drag-over');
      if (dragOverPosition === 'before') {
        classes.push('drag-over-before');
      } else if (dragOverPosition === 'after') {
        classes.push('drag-over-after');
      }
    }
    return classes.join(' ');
  };

  return (
    <ul
      className="thought-list-container"
      ref={containerRef}
      tabIndex={0}
      role="listbox"
      aria-label="Thoughts list"
    >
      {sortedThoughts.map((thought, index) => (
        <li
          key={thought.id}
          className={getItemClassName(thought.id)}
          role="option"
          aria-selected={focusedIndex === index}
          draggable
          onDragStart={(e) => handleDragStart(e, thought.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, thought.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, thought.id)}
        >
          <div className="thought-drag-handle" aria-hidden="true">
            <span className="drag-dots"></span>
          </div>
          <button
            ref={(el) => setItemRef(index, el)}
            className={`thought-list-button ${focusedIndex === index ? 'focused' : ''}`}
            onClick={() => handleOpenThought(thought.id)}
            onFocus={() => setFocusedIndex(index)}
            tabIndex={focusedIndex === index ? 0 : -1}
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
