import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore, getApiKey } from '../../store/settingsStore';

interface APIKeyConfig {
  id: keyof ReturnType<typeof useSettingsStore.getState>['apiKeys'];
  label: string;
  description: string;
  required?: boolean;
  docsUrl: string;
}

const API_KEYS: APIKeyConfig[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter (Recommended)',
    description: 'Access to Claude and other AI models. Better pricing.',
    required: true,
    docsUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Direct)',
    description: 'Alternative: Direct Anthropic API access',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'For Whisper voice transcription and DALL-E images',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'groq',
    label: 'Groq',
    description: 'Fast Whisper transcription (recommended for low latency)',
    docsUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'elevenLabs',
    label: 'ElevenLabs',
    description: 'For AI character voices (text-to-speech)',
    docsUrl: 'https://elevenlabs.io/app/settings/api-keys',
  },
  {
    id: 'fal',
    label: 'FAL.ai',
    description: 'Fast, cheap image generation (~$0.01/image)',
    docsUrl: 'https://fal.ai/dashboard/keys',
  },
  {
    id: 'stability',
    label: 'Stability AI',
    description: 'Alternative image generation provider',
    docsUrl: 'https://platform.stability.ai/account/keys',
  },
  {
    id: 'replicate',
    label: 'Replicate',
    description: 'Access to many AI models including SDXL',
    docsUrl: 'https://replicate.com/account/api-tokens',
  },
];

const IMAGE_PROVIDERS = [
  { id: 'fal' as const, label: 'FAL.ai (Recommended)', keyRequired: 'fal' as const },
  { id: 'openai' as const, label: 'OpenAI DALL-E', keyRequired: 'openai' as const },
  { id: 'stability' as const, label: 'Stability AI', keyRequired: 'stability' as const },
  { id: 'replicate' as const, label: 'Replicate', keyRequired: 'replicate' as const },
];

const TRANSCRIPTION_PROVIDERS = [
  { id: 'groq' as const, label: 'Groq (Fastest)', keyRequired: 'groq' as const, models: ['whisper-large-v3-turbo', 'whisper-large-v3', 'distil-whisper-large-v3-en'] },
  { id: 'openai' as const, label: 'OpenAI Whisper', keyRequired: 'openai' as const, models: ['whisper-1'] },
];

export default function APIKeysSection() {
  const { apiKeys, setApiKey, clearApiKey, imageProvider, setImageProvider, transcriptionProvider, setTranscriptionProvider, transcriptionModel, setTranscriptionModel } = useSettingsStore();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});

  const handleEditKey = (keyId: string) => {
    setEditingKey(keyId);
    setKeyInputs({ ...keyInputs, [keyId]: '' });
  };

  const handleSaveKey = (keyId: keyof typeof apiKeys) => {
    const value = keyInputs[keyId]?.trim();
    if (value) {
      setApiKey(keyId, value);
    }
    setEditingKey(null);
    setKeyInputs({ ...keyInputs, [keyId]: '' });
  };

  const handleClearKey = (keyId: keyof typeof apiKeys) => {
    clearApiKey(keyId);
    setEditingKey(null);
  };

  const isKeyConfigured = (keyId: keyof typeof apiKeys) => {
    return Boolean(getApiKey(keyId));
  };

  const isKeyFromEnv = (keyId: keyof typeof apiKeys) => {
    // Check if key is from env (not in store but getApiKey returns something)
    return !apiKeys[keyId] && Boolean(getApiKey(keyId));
  };

  return (
    <>
      {/* API Keys Section */}
      <section className="settings-section">
        <h3>API Keys</h3>
        <p className="section-description">
          Enter your API keys to enable features. Keys are stored locally on your device.
        </p>

        <div className="api-keys-list">
          {API_KEYS.map((config) => {
            const configured = isKeyConfigured(config.id);
            const fromEnv = isKeyFromEnv(config.id);
            const isEditing = editingKey === config.id;

            return (
              <div key={config.id} className="api-key-item">
                <div className="api-key-header">
                  <div className="api-key-info">
                    <span className="api-key-label">
                      {config.label}
                      {config.required && <span className="required-badge">Required</span>}
                    </span>
                    <span className="api-key-description">{config.description}</span>
                  </div>
                  <div className="api-key-status">
                    {configured ? (
                      <span className={`status-badge configured ${fromEnv ? 'from-env' : ''}`}>
                        {fromEnv ? 'From .env' : 'Configured'}
                      </span>
                    ) : (
                      <span className="status-badge not-configured">Not set</span>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="api-key-edit">
                    <input
                      type="password"
                      placeholder={`Enter your ${config.label} API key`}
                      value={keyInputs[config.id] || ''}
                      onChange={(e) =>
                        setKeyInputs({ ...keyInputs, [config.id]: e.target.value })
                      }
                      autoFocus
                      className="api-key-input"
                    />
                    <div className="api-key-actions">
                      <button
                        className="key-btn save"
                        onClick={() => handleSaveKey(config.id)}
                        disabled={!keyInputs[config.id]?.trim()}
                      >
                        Save
                      </button>
                      <button
                        className="key-btn cancel"
                        onClick={() => setEditingKey(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="api-key-actions-row">
                    <button
                      className="key-btn link"
                      onClick={() => invoke('open_external_url', { url: config.docsUrl })}
                    >
                      Get Key
                    </button>
                    <button
                      className="key-btn edit"
                      onClick={() => handleEditKey(config.id)}
                    >
                      {configured && !fromEnv ? 'Change' : 'Set Key'}
                    </button>
                    {configured && !fromEnv && (
                      <button
                        className="key-btn clear"
                        onClick={() => handleClearKey(config.id)}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Transcription Provider */}
      <section className="settings-section">
        <h3>Transcription</h3>
        <p className="section-description">
          Choose which provider for voice-to-text. Groq is significantly faster.
        </p>

        <div className="provider-selector">
          {TRANSCRIPTION_PROVIDERS.map((provider) => {
            const hasKey = isKeyConfigured(provider.keyRequired);
            return (
              <label
                key={provider.id}
                className={`provider-option ${transcriptionProvider === provider.id ? 'active' : ''} ${!hasKey ? 'disabled' : ''}`}
              >
                <input
                  type="radio"
                  name="transcriptionProvider"
                  value={provider.id}
                  checked={transcriptionProvider === provider.id}
                  onChange={() => {
                    setTranscriptionProvider(provider.id);
                    // Auto-select first model for the provider
                    setTranscriptionModel(provider.models[0]);
                  }}
                  disabled={!hasKey}
                />
                <span className="provider-label">{provider.label}</span>
                {!hasKey && <span className="provider-hint">Needs API key</span>}
              </label>
            );
          })}
        </div>

        {/* Model selector for current provider */}
        {(() => {
          const currentProvider = TRANSCRIPTION_PROVIDERS.find(p => p.id === transcriptionProvider);
          if (!currentProvider || currentProvider.models.length <= 1) return null;
          return (
            <div className="setting-row" style={{ marginTop: '8px' }}>
              <label className="model-select-label">
                <span>Model</span>
                <select
                  value={transcriptionModel || currentProvider.models[0]}
                  onChange={(e) => setTranscriptionModel(e.target.value)}
                  className="model-select"
                >
                  {currentProvider.models.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </label>
            </div>
          );
        })()}
      </section>

      {/* Image Generation Provider */}
      <section className="settings-section">
        <h3>Image Generation</h3>
        <p className="section-description">
          Choose which provider to use for generating character portraits.
        </p>

        <div className="provider-selector">
          {IMAGE_PROVIDERS.map((provider) => {
            const hasKey = isKeyConfigured(provider.keyRequired);
            return (
              <label
                key={provider.id}
                className={`provider-option ${imageProvider === provider.id ? 'active' : ''} ${!hasKey ? 'disabled' : ''}`}
              >
                <input
                  type="radio"
                  name="imageProvider"
                  value={provider.id}
                  checked={imageProvider === provider.id}
                  onChange={() => setImageProvider(provider.id)}
                  disabled={!hasKey}
                />
                <span className="provider-label">{provider.label}</span>
                {!hasKey && <span className="provider-hint">Needs API key</span>}
              </label>
            );
          })}
        </div>
      </section>
    </>
  );
}
