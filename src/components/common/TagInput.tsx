import { useState, useCallback, KeyboardEvent } from 'react';
import './TagInput.css';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export default function TagInput({ tags, onChange, placeholder = 'Add tag...', readOnly }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = inputValue.trim().toLowerCase();
      if (newTag && !tags.includes(newTag)) {
        onChange([...tags, newTag]);
      }
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }, [inputValue, tags, onChange]);

  const removeTag = useCallback((tagToRemove: string) => {
    onChange(tags.filter((t) => t !== tagToRemove));
  }, [tags, onChange]);

  return (
    <div className={`tag-input-container ${readOnly ? 'read-only' : ''}`}>
      {tags.map((tag) => (
        <span key={tag} className="tag">
          #{tag}
          {!readOnly && (
            <button
              className="tag-remove"
              onClick={() => removeTag(tag)}
              type="button"
            >
              &times;
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <input
          type="text"
          className="tag-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
        />
      )}
    </div>
  );
}

// Display-only tags component
export function TagList({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="tag-list">
      {tags.map((tag) => (
        <span key={tag} className="tag">#{tag}</span>
      ))}
    </div>
  );
}
