import { useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { exportToJSON, importFromJSON, exportThoughtsAsMarkdown } from '../../services/exportImport';
import { themes, themeNames } from '../../styles/themes';
import AuthSection from './AuthSection';
import './Settings.css';

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const {
    displayMode,
    setDisplayMode,
    theme,
    setTheme,
    voiceEnabled,
    setVoiceEnabled,
    ttsEnabled,
    setTtsEnabled,
    soundsEnabled,
    setSoundsEnabled,
    restoreWindows,
    setRestoreWindows,
    customPositions,
    addCustomPosition,
    removeCustomPosition,
  } = useSettingsStore();

  const [newPositionName, setNewPositionName] = useState('');
  const [newPositionX, setNewPositionX] = useState('100');
  const [newPositionY, setNewPositionY] = useState('100');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleAddPosition = () => {
    if (!newPositionName.trim()) return;

    addCustomPosition({
      name: newPositionName.trim(),
      x: parseInt(newPositionX, 10) || 100,
      y: parseInt(newPositionY, 10) || 100,
    });

    setNewPositionName('');
    setNewPositionX('100');
    setNewPositionY('100');
  };

  const handleImport = async (mode: 'merge' | 'replace') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        setImportStatus('Importing...');
        const result = await importFromJSON(file, mode);
        setImportStatus(
          `Imported ${result.thoughtsImported} thoughts, ${result.windowsImported} windows`
        );
        setTimeout(() => setImportStatus(null), 3000);
      } catch (err) {
        setImportStatus(`Error: ${(err as Error).message}`);
        setTimeout(() => setImportStatus(null), 3000);
      }
    };
    input.click();
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <header className="settings-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </header>

        <div className="settings-content">
          {/* Display Mode */}
          <section className="settings-section">
            <h3>Display Mode</h3>
            <div className="setting-row">
              <label className="radio-label">
                <input
                  type="radio"
                  name="displayMode"
                  checked={displayMode === 'control'}
                  onChange={() => setDisplayMode('control')}
                />
                <span className="radio-text">
                  <strong>Control Surface</strong>
                  <small>Main window shows controls, thoughts open in separate windows</small>
                </span>
              </label>
            </div>
            <div className="setting-row">
              <label className="radio-label">
                <input
                  type="radio"
                  name="displayMode"
                  checked={displayMode === 'integrated'}
                  onChange={() => setDisplayMode('integrated')}
                />
                <span className="radio-text">
                  <strong>Integrated</strong>
                  <small>Main window shows active thought with voice indicator</small>
                </span>
              </label>
            </div>
          </section>

          {/* Theme */}
          <section className="settings-section">
            <h3>Theme</h3>
            <div className="theme-picker">
              {themeNames.map((themeName) => (
                <button
                  key={themeName}
                  className={`theme-option ${theme === themeName ? 'active' : ''}`}
                  onClick={() => setTheme(themeName)}
                  style={{
                    '--preview-bg': themes[themeName].variables['--bg-primary'],
                    '--preview-accent': themes[themeName].variables['--accent-color'],
                  } as React.CSSProperties}
                >
                  <span className="theme-preview" />
                  <span className="theme-name">{themes[themeName].label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Voice */}
          <section className="settings-section">
            <h3>Voice</h3>
            <div className="setting-row">
              <label className="toggle-label">
                <span>Voice Input</span>
                <input
                  type="checkbox"
                  checked={voiceEnabled}
                  onChange={(e) => setVoiceEnabled(e.target.checked)}
                />
                <span className="toggle-switch" />
              </label>
            </div>
            <div className="setting-row">
              <label className="toggle-label">
                <span>Text-to-Speech Responses</span>
                <input
                  type="checkbox"
                  checked={ttsEnabled}
                  onChange={(e) => setTtsEnabled(e.target.checked)}
                />
                <span className="toggle-switch" />
              </label>
            </div>
            <div className="setting-row">
              <label className="toggle-label">
                <span>Sound Effects</span>
                <input
                  type="checkbox"
                  checked={soundsEnabled}
                  onChange={(e) => setSoundsEnabled(e.target.checked)}
                />
                <span className="toggle-switch" />
              </label>
            </div>
          </section>

          {/* Windows */}
          <section className="settings-section">
            <h3>Windows</h3>
            <div className="setting-row">
              <label className="toggle-label">
                <span>Restore Windows on Startup</span>
                <input
                  type="checkbox"
                  checked={restoreWindows}
                  onChange={(e) => setRestoreWindows(e.target.checked)}
                />
                <span className="toggle-switch" />
              </label>
            </div>
          </section>

          {/* Custom Positions */}
          <section className="settings-section">
            <h3>Custom Window Positions</h3>
            <p className="section-description">
              Define named positions you can reference by voice (e.g., "put this in workspace")
            </p>

            <div className="positions-list">
              {customPositions.map((pos) => (
                <div key={pos.name} className="position-item">
                  <span className="position-name">{pos.name}</span>
                  <span className="position-coords">
                    ({pos.x}, {pos.y})
                  </span>
                  <button
                    className="remove-btn"
                    onClick={() => removeCustomPosition(pos.name)}
                  >
                    &times;
                  </button>
                </div>
              ))}
              {customPositions.length === 0 && (
                <p className="empty-positions">No custom positions defined</p>
              )}
            </div>

            <div className="add-position-form">
              <input
                type="text"
                placeholder="Name (e.g., workspace)"
                value={newPositionName}
                onChange={(e) => setNewPositionName(e.target.value)}
                className="position-input name-input"
              />
              <input
                type="number"
                placeholder="X"
                value={newPositionX}
                onChange={(e) => setNewPositionX(e.target.value)}
                className="position-input coord-input"
              />
              <input
                type="number"
                placeholder="Y"
                value={newPositionY}
                onChange={(e) => setNewPositionY(e.target.value)}
                className="position-input coord-input"
              />
              <button
                className="add-btn"
                onClick={handleAddPosition}
                disabled={!newPositionName.trim()}
              >
                Add
              </button>
            </div>
          </section>

          {/* Keyboard Shortcuts Reference */}
          <section className="settings-section">
            <h3>Keyboard Shortcuts</h3>
            <div className="shortcuts-list">
              <div className="shortcut-item">
                <kbd>Esc</kbd>
                <span>Toggle voice listening</span>
              </div>
              <div className="shortcut-item">
                <kbd>Cmd+N</kbd>
                <span>New thought</span>
              </div>
              <div className="shortcut-item">
                <kbd>Cmd+Shift+H</kbd>
                <span>Open thought history</span>
              </div>
              <div className="shortcut-item">
                <kbd>Cmd+W</kbd>
                <span>Close current window</span>
              </div>
              <div className="shortcut-item">
                <kbd>Cmd+,</kbd>
                <span>Open settings</span>
              </div>
              <div className="shortcut-item">
                <kbd>Cmd+Shift+V</kbd>
                <span>Toggle voice enabled</span>
              </div>
              <div className="shortcut-item">
                <kbd>Cmd+Z</kbd>
                <span>Undo last action</span>
              </div>
            </div>
          </section>

          {/* Data Management */}
          <section className="settings-section">
            <h3>Data Management</h3>
            <p className="section-description">
              Export your thoughts and settings for backup, or import from a previous backup.
            </p>

            <div className="data-actions">
              <div className="action-group">
                <h4>Export</h4>
                <div className="button-row">
                  <button className="action-btn" onClick={exportToJSON}>
                    Export All (JSON)
                  </button>
                  <button className="action-btn secondary" onClick={exportThoughtsAsMarkdown}>
                    Export Thoughts (Markdown)
                  </button>
                </div>
              </div>

              <div className="action-group">
                <h4>Import</h4>
                <div className="button-row">
                  <button className="action-btn" onClick={() => handleImport('merge')}>
                    Import &amp; Merge
                  </button>
                  <button className="action-btn danger" onClick={() => handleImport('replace')}>
                    Import &amp; Replace
                  </button>
                </div>
                <p className="action-hint">
                  Merge adds new items. Replace overwrites existing data.
                </p>
              </div>

              {importStatus && (
                <div className={`import-status ${importStatus.startsWith('Error') ? 'error' : ''}`}>
                  {importStatus}
                </div>
              )}
            </div>
          </section>

          {/* Auth / Cloud Sync */}
          <AuthSection />
        </div>
      </div>
    </div>
  );
}
