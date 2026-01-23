import { useState, useCallback, useEffect } from 'react';
import { useCharacterStore } from '../../store/characterStore';
import {
  type CharacterInput,
  type PersonalityTrait,
  type VoiceSettings,
  type AppearanceSettings,
  COMMON_TRAITS,
  ELEVENLABS_VOICES,
  DEFAULT_VOICE_SETTINGS,
  DEFAULT_APPEARANCE_SETTINGS,
  generateSystemPromptFromTraits,
} from '../../models/character';
import './CharacterCreator.css';

interface CharacterCreatorProps {
  onClose: (newCharacterId?: string) => void;
  /** Optional: Edit an existing character by ID */
  editCharacterId?: string;
}

export default function CharacterCreator({
  onClose,
  editCharacterId,
}: CharacterCreatorProps) {
  const { addCharacter, updateCharacter, getCharacter } = useCharacterStore();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [personalityTraits, setPersonalityTraits] = useState<PersonalityTrait[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    ...DEFAULT_VOICE_SETTINGS,
  });
  const [appearance, setAppearance] = useState<AppearanceSettings>({
    ...DEFAULT_APPEARANCE_SETTINGS,
  });

  // UI state
  const [activeTab, setActiveTab] = useState<'basic' | 'voice' | 'appearance'>('basic');
  const [showTraitPicker, setShowTraitPicker] = useState(false);
  const [customTrait, setCustomTrait] = useState('');
  const [autoGeneratePrompt, setAutoGeneratePrompt] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load existing character if editing
  useEffect(() => {
    if (editCharacterId) {
      const character = getCharacter(editCharacterId);
      if (character) {
        setName(character.name);
        setDescription(character.description);
        setPersonalityTraits(character.personalityTraits);
        setSystemPrompt(character.systemPrompt);
        setVoiceSettings(character.voiceSettings);
        setAppearance(character.appearance);
        setAutoGeneratePrompt(false); // Don't auto-generate when editing
      }
    }
  }, [editCharacterId, getCharacter]);

  // Auto-generate system prompt when traits change
  useEffect(() => {
    if (autoGeneratePrompt && name) {
      const generated = generateSystemPromptFromTraits(name, description, personalityTraits);
      setSystemPrompt(generated);
    }
  }, [name, description, personalityTraits, autoGeneratePrompt]);

  // Handle trait toggle
  const toggleTrait = useCallback((traitName: string) => {
    setPersonalityTraits((prev) => {
      const existing = prev.find((t) => t.trait === traitName);
      if (existing) {
        return prev.filter((t) => t.trait !== traitName);
      }
      return [...prev, { trait: traitName, intensity: 0.7 }];
    });
  }, []);

  // Handle trait intensity change
  const setTraitIntensity = useCallback((traitName: string, intensity: number) => {
    setPersonalityTraits((prev) =>
      prev.map((t) => (t.trait === traitName ? { ...t, intensity } : t))
    );
  }, []);

  // Add custom trait
  const handleAddCustomTrait = useCallback(() => {
    if (customTrait.trim()) {
      const traitName = customTrait.trim().toLowerCase();
      if (!personalityTraits.find((t) => t.trait === traitName)) {
        setPersonalityTraits((prev) => [...prev, { trait: traitName, intensity: 0.7 }]);
      }
      setCustomTrait('');
    }
  }, [customTrait, personalityTraits]);

  // Handle voice selection
  const handleVoiceSelect = useCallback((voiceId: string) => {
    const voice = ELEVENLABS_VOICES.find((v) => v.voiceId === voiceId);
    if (voice) {
      setVoiceSettings((prev) => ({
        ...prev,
        voiceId: voice.voiceId,
        voiceName: voice.voiceName,
      }));
    }
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(() => {
    // Validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!systemPrompt.trim()) {
      setError('System prompt is required');
      return;
    }

    const characterInput: CharacterInput = {
      name: name.trim(),
      description: description.trim(),
      personalityTraits,
      systemPrompt: systemPrompt.trim(),
      voiceSettings,
      appearance,
      isActive: false,
    };

    try {
      if (editCharacterId) {
        updateCharacter(editCharacterId, characterInput);
        onClose(); // No new character, just close
      } else {
        const newCharacter = addCharacter(characterInput);
        onClose(newCharacter.id); // Pass new character ID to auto-select
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [
    name,
    description,
    personalityTraits,
    systemPrompt,
    voiceSettings,
    appearance,
    editCharacterId,
    addCharacter,
    updateCharacter,
    onClose,
  ]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleSubmit]);

  return (
    <div className="character-creator-overlay" onClick={() => onClose()}>
      <div className="character-creator-panel" onClick={(e) => e.stopPropagation()}>
        <header className="character-creator-header">
          <h2>{editCharacterId ? 'Edit Character' : 'Create Character'}</h2>
          <button className="close-btn" onClick={() => onClose()}>
            &times;
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="tab-nav">
          <button
            className={`tab-btn ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            Basic Info
          </button>
          <button
            className={`tab-btn ${activeTab === 'voice' ? 'active' : ''}`}
            onClick={() => setActiveTab('voice')}
          >
            Voice
          </button>
          <button
            className={`tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            Appearance
          </button>
        </div>

        <div className="character-creator-content">
          {error && (
            <div className="error-message">
              {error}
              <button onClick={() => setError(null)}>&times;</button>
            </div>
          )}

          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="tab-content">
              {/* Name */}
              <div className="form-group">
                <label htmlFor="character-name">Name</label>
                <input
                  id="character-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Nikola Tesla"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div className="form-group">
                <label htmlFor="character-description">Description</label>
                <textarea
                  id="character-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Who is this character? What are they known for?"
                  rows={3}
                />
              </div>

              {/* Personality Traits */}
              <div className="form-group">
                <label>
                  Personality Traits
                  <button
                    className="add-trait-btn"
                    onClick={() => setShowTraitPicker(!showTraitPicker)}
                  >
                    {showTraitPicker ? 'Hide' : 'Add Traits'}
                  </button>
                </label>

                {showTraitPicker && (
                  <div className="trait-picker">
                    <div className="common-traits">
                      {COMMON_TRAITS.map((trait) => (
                        <button
                          key={trait}
                          className={`trait-chip ${
                            personalityTraits.find((t) => t.trait === trait) ? 'selected' : ''
                          }`}
                          onClick={() => toggleTrait(trait)}
                        >
                          {trait}
                        </button>
                      ))}
                    </div>
                    <div className="custom-trait-input">
                      <input
                        type="text"
                        value={customTrait}
                        onChange={(e) => setCustomTrait(e.target.value)}
                        placeholder="Add custom trait..."
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTrait()}
                      />
                      <button onClick={handleAddCustomTrait}>Add</button>
                    </div>
                  </div>
                )}

                {/* Selected traits with intensity sliders */}
                {personalityTraits.length > 0 && (
                  <div className="selected-traits">
                    {personalityTraits.map((trait) => (
                      <div key={trait.trait} className="trait-item">
                        <div className="trait-header">
                          <span className="trait-name">{trait.trait}</span>
                          <button
                            className="remove-trait-btn"
                            onClick={() => toggleTrait(trait.trait)}
                          >
                            &times;
                          </button>
                        </div>
                        <div className="trait-slider">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={trait.intensity}
                            onChange={(e) =>
                              setTraitIntensity(trait.trait, parseFloat(e.target.value))
                            }
                          />
                          <span className="intensity-value">
                            {Math.round(trait.intensity * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* System Prompt */}
              <div className="form-group">
                <label htmlFor="system-prompt">
                  System Prompt
                  <label className="auto-generate-toggle">
                    <input
                      type="checkbox"
                      checked={autoGeneratePrompt}
                      onChange={(e) => setAutoGeneratePrompt(e.target.checked)}
                    />
                    <span>Auto-generate</span>
                  </label>
                </label>
                <textarea
                  id="system-prompt"
                  value={systemPrompt}
                  onChange={(e) => {
                    setSystemPrompt(e.target.value);
                    setAutoGeneratePrompt(false);
                  }}
                  placeholder="Instructions for how the AI should behave as this character..."
                  rows={6}
                  className="system-prompt-input"
                />
                <p className="form-hint">
                  This prompt tells the AI how to embody this character.
                </p>
              </div>
            </div>
          )}

          {/* Voice Tab */}
          {activeTab === 'voice' && (
            <div className="tab-content">
              <div className="form-group">
                <label>Voice Selection (ElevenLabs)</label>
                <div className="voice-list">
                  {ELEVENLABS_VOICES.map((voice) => (
                    <button
                      key={voice.voiceId}
                      className={`voice-option ${
                        voiceSettings.voiceId === voice.voiceId ? 'selected' : ''
                      }`}
                      onClick={() => handleVoiceSelect(voice.voiceId)}
                    >
                      <span className="voice-name">{voice.voiceName}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="custom-voice-id">Custom Voice ID</label>
                <input
                  id="custom-voice-id"
                  type="text"
                  value={voiceSettings.voiceId}
                  onChange={(e) =>
                    setVoiceSettings((prev) => ({
                      ...prev,
                      voiceId: e.target.value,
                      voiceName: 'Custom',
                    }))
                  }
                  placeholder="Enter ElevenLabs voice ID"
                />
              </div>

              <div className="form-group">
                <label>
                  Stability: {Math.round(voiceSettings.stability * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={voiceSettings.stability}
                  onChange={(e) =>
                    setVoiceSettings((prev) => ({
                      ...prev,
                      stability: parseFloat(e.target.value),
                    }))
                  }
                />
                <p className="form-hint">
                  Lower = more expressive, Higher = more consistent
                </p>
              </div>

              <div className="form-group">
                <label>
                  Similarity: {Math.round(voiceSettings.similarityBoost * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={voiceSettings.similarityBoost}
                  onChange={(e) =>
                    setVoiceSettings((prev) => ({
                      ...prev,
                      similarityBoost: parseFloat(e.target.value),
                    }))
                  }
                />
                <p className="form-hint">
                  How closely to match the original voice
                </p>
              </div>

              <div className="form-group">
                <label className="toggle-label">
                  <span>Speaker Boost</span>
                  <input
                    type="checkbox"
                    checked={voiceSettings.useSpeakerBoost ?? true}
                    onChange={(e) =>
                      setVoiceSettings((prev) => ({
                        ...prev,
                        useSpeakerBoost: e.target.checked,
                      }))
                    }
                  />
                  <span className="toggle-switch" />
                </label>
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="tab-content">
              <div className="form-group">
                <label htmlFor="appearance-description">Visual Description</label>
                <textarea
                  id="appearance-description"
                  value={appearance.description}
                  onChange={(e) =>
                    setAppearance((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Describe the character's appearance for AI image generation..."
                  rows={4}
                />
                <p className="form-hint">
                  Used as a prompt for generating character portraits
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="art-style">Art Style</label>
                <select
                  id="art-style"
                  value={appearance.artStyle || 'realistic'}
                  onChange={(e) =>
                    setAppearance((prev) => ({
                      ...prev,
                      artStyle: e.target.value,
                    }))
                  }
                >
                  <option value="realistic">Realistic</option>
                  <option value="anime">Anime</option>
                  <option value="oil-painting">Oil Painting</option>
                  <option value="watercolor">Watercolor</option>
                  <option value="pencil-sketch">Pencil Sketch</option>
                  <option value="digital-art">Digital Art</option>
                  <option value="pixel-art">Pixel Art</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="accent-color">Accent Color</label>
                <div className="color-input-row">
                  <input
                    id="accent-color"
                    type="color"
                    value={appearance.accentColor || '#06d6a0'}
                    onChange={(e) =>
                      setAppearance((prev) => ({
                        ...prev,
                        accentColor: e.target.value,
                      }))
                    }
                  />
                  <span className="color-value">{appearance.accentColor}</span>
                </div>
                <p className="form-hint">
                  Theme color associated with this character
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="portrait-url">Portrait URL (Optional)</label>
                <input
                  id="portrait-url"
                  type="text"
                  value={appearance.portraitUrl || ''}
                  onChange={(e) =>
                    setAppearance((prev) => ({
                      ...prev,
                      portraitUrl: e.target.value || undefined,
                    }))
                  }
                  placeholder="https://example.com/portrait.png"
                />
                {appearance.portraitUrl && (
                  <div className="portrait-preview">
                    <img
                      src={appearance.portraitUrl}
                      alt="Character portrait"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="character-creator-footer">
          <div className="footer-hint">
            <kbd>Esc</kbd> to cancel, <kbd>Cmd+Enter</kbd> to save
          </div>
          <div className="footer-actions">
            <button className="btn-secondary" onClick={() => onClose()}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSubmit}>
              {editCharacterId ? 'Save Changes' : 'Create Character'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
