import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useCharacterStore } from '../../store/characterStore';
import { generateCharacterPortrait, isImageGenAvailable } from '../../services/imageGen';
import type { Character } from '../../models/character';
import './CharacterSelector.css';

// Lazy load CharacterCreator
const CharacterCreator = lazy(() => import('../CharacterCreator/CharacterCreator'));

interface CharacterSelectorProps {
  onSelectCharacter: (characterId: string) => void;
  onClose?: () => void;
}

export default function CharacterSelector({
  onSelectCharacter,
  onClose,
}: CharacterSelectorProps) {
  const { characters, initSync, deleteCharacter } = useCharacterStore();
  const [showCreator, setShowCreator] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<string | undefined>(undefined);
  const [generatingPortrait, setGeneratingPortrait] = useState<string | null>(null);
  const [hoveredCharacter, setHoveredCharacter] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Initialize sync
  useEffect(() => {
    const unsubscribe = initSync();
    return unsubscribe;
  }, [initSync]);

  // Handle character selection
  const handleSelect = useCallback(
    (character: Character) => {
      onSelectCharacter(character.id);
    },
    [onSelectCharacter]
  );

  // Handle edit
  const handleEdit = useCallback((e: React.MouseEvent, characterId: string) => {
    e.stopPropagation();
    setEditingCharacterId(characterId);
    setShowCreator(true);
  }, []);

  // Handle delete
  const handleDelete = useCallback(
    (e: React.MouseEvent, characterId: string) => {
      e.stopPropagation();
      if (confirmDelete === characterId) {
        deleteCharacter(characterId);
        setConfirmDelete(null);
      } else {
        setConfirmDelete(characterId);
        // Auto-reset after 3 seconds
        setTimeout(() => setConfirmDelete(null), 3000);
      }
    },
    [confirmDelete, deleteCharacter]
  );

  // Generate portrait for character
  const handleGeneratePortrait = useCallback(
    async (e: React.MouseEvent, character: Character) => {
      e.stopPropagation();

      if (!isImageGenAvailable() || !character.appearance.description) {
        return;
      }

      setGeneratingPortrait(character.id);

      try {
        const base64 = await generateCharacterPortrait(
          character.appearance.description,
          character.appearance.artStyle
        );

        useCharacterStore.getState().updateCharacter(character.id, {
          appearance: { ...character.appearance, portraitUrl: base64 },
        });
      } catch (err) {
        console.error('Failed to generate portrait:', err);
      } finally {
        setGeneratingPortrait(null);
      }
    },
    []
  );

  // Close creator
  const handleCloseCreator = useCallback(() => {
    setShowCreator(false);
    setEditingCharacterId(undefined);
  }, []);

  // Open creator for new character
  const handleCreateNew = useCallback(() => {
    setEditingCharacterId(undefined);
    setShowCreator(true);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCreator) {
          handleCloseCreator();
        } else if (onClose) {
          onClose();
        }
      } else if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleCreateNew();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreator, handleCloseCreator, onClose, handleCreateNew]);

  return (
    <div className="character-selector">
      <Suspense fallback={null}>
        {showCreator && (
          <CharacterCreator
            onClose={handleCloseCreator}
            editCharacterId={editingCharacterId}
          />
        )}
      </Suspense>

      <header className="cs-header">
        <h1 className="cs-title">Summon a Character</h1>
        <p className="cs-subtitle">
          Choose a character to start a conversation with
        </p>
      </header>

      <div className="cs-grid">
        {/* Create New Card */}
        <button className="cs-card cs-create-card" onClick={handleCreateNew}>
          <div className="cs-create-icon">
            <PlusIcon />
          </div>
          <span className="cs-create-label">Create New</span>
          <span className="cs-create-hint">
            <kbd>Cmd+N</kbd>
          </span>
        </button>

        {/* Character Cards */}
        {characters.map((character) => (
          <div
            key={character.id}
            className={`cs-card ${hoveredCharacter === character.id ? 'hovered' : ''}`}
            onClick={() => handleSelect(character)}
            onMouseEnter={() => setHoveredCharacter(character.id)}
            onMouseLeave={() => setHoveredCharacter(null)}
            style={
              {
                '--accent': character.appearance.accentColor || '#06d6a0',
              } as React.CSSProperties
            }
          >
            {/* Portrait */}
            <div className="cs-portrait">
              {generatingPortrait === character.id ? (
                <div className="cs-portrait-loading">
                  <div className="loading-spinner" />
                </div>
              ) : character.appearance.portraitUrl ? (
                <img
                  src={character.appearance.portraitUrl}
                  alt={character.name}
                  className="cs-portrait-image"
                />
              ) : (
                <div className="cs-portrait-placeholder">
                  <span className="cs-portrait-initial">{character.name[0]}</span>
                  {isImageGenAvailable() && character.appearance.description && (
                    <button
                      className="cs-generate-btn"
                      onClick={(e) => handleGeneratePortrait(e, character)}
                      title="Generate portrait"
                    >
                      <ImageIcon />
                    </button>
                  )}
                </div>
              )}

              {/* Accent overlay */}
              <div className="cs-portrait-overlay" />
            </div>

            {/* Info */}
            <div className="cs-info">
              <h3 className="cs-name">{character.name}</h3>
              <p className="cs-description">
                {character.description || 'No description'}
              </p>

              {/* Traits */}
              {character.personalityTraits.length > 0 && (
                <div className="cs-traits">
                  {character.personalityTraits.slice(0, 3).map((trait) => (
                    <span key={trait.trait} className="cs-trait">
                      {trait.trait}
                    </span>
                  ))}
                  {character.personalityTraits.length > 3 && (
                    <span className="cs-trait-more">
                      +{character.personalityTraits.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Actions (visible on hover) */}
            <div className="cs-actions">
              <button
                className="cs-action-btn cs-summon-btn"
                onClick={() => handleSelect(character)}
                title="Summon"
              >
                <SummonIcon />
                <span>Summon</span>
              </button>
              <button
                className="cs-action-btn"
                onClick={(e) => handleEdit(e, character.id)}
                title="Edit"
              >
                <EditIcon />
              </button>
              <button
                className={`cs-action-btn cs-delete-btn ${
                  confirmDelete === character.id ? 'confirm' : ''
                }`}
                onClick={(e) => handleDelete(e, character.id)}
                title={confirmDelete === character.id ? 'Click again to confirm' : 'Delete'}
              >
                {confirmDelete === character.id ? <CheckIcon /> : <DeleteIcon />}
              </button>
            </div>

            {/* Voice indicator */}
            {character.voiceSettings.voiceId && (
              <div className="cs-voice-indicator" title="Has voice configured">
                <VoiceIcon />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty state */}
      {characters.length === 0 && (
        <div className="cs-empty">
          <div className="cs-empty-icon">
            <GhostIcon />
          </div>
          <h3>No characters yet</h3>
          <p>Create your first AI character to start conversations</p>
          <button className="cs-empty-btn" onClick={handleCreateNew}>
            Create Character
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="cs-footer">
        <span className="cs-hint">
          Click a character to start a conversation
        </span>
        {onClose && (
          <button className="cs-close-btn" onClick={onClose}>
            Close <kbd>Esc</kbd>
          </button>
        )}
      </footer>
    </div>
  );
}

// Icon components
function PlusIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 8v16M8 16h16" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="12" height="12" rx="1" />
      <circle cx="5.5" cy="5.5" r="1" />
      <path d="M14 10l-3-3-5 5M14 14H5l4-4" />
    </svg>
  );
}

function SummonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2v4M8 10v4M2 8h4M10 8h4" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9.5 2.5l2 2L4.5 11.5H2.5v-2l7-7z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4h8l-.5 8H3.5L3 4zM5.5 6v4M8.5 6v4M5 4V2.5h4V4M2 4h10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7l3 3 5-5" />
    </svg>
  );
}

function VoiceIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 1C4.34 1 3 2.34 3 4v2c0 1.66 1.34 3 3 3s3-1.34 3-3V4c0-1.66-1.34-3-3-3zM1 5v1c0 2.76 2.24 5 5 5s5-2.24 5-5V5h-1v1c0 2.21-1.79 4-4 4S2 8.21 2 6V5H1zM5.5 11v1h1v-1h-1z" />
    </svg>
  );
}

function GhostIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M24 8c-7.18 0-13 5.82-13 13v19c0 0 3-3 6.5-3s5 3 6.5 3 3.5-3 6.5-3 6.5 3 6.5 3V21c0-7.18-5.82-13-13-13z" />
      <circle cx="19" cy="22" r="2" fill="currentColor" />
      <circle cx="29" cy="22" r="2" fill="currentColor" />
    </svg>
  );
}
