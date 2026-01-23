import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore, getApiKey } from '../../store/settingsStore';
import './SetupWizard.css';

interface SetupStep {
  id: keyof ReturnType<typeof useSettingsStore.getState>['apiKeys'];
  title: string;
  description: string;
  required: boolean;
  url: string;
  urlLabel: string;
  placeholder: string;
  helpText: string;
}

const SETUP_STEPS: SetupStep[] = [
  {
    id: 'anthropic',
    title: 'Anthropic (Claude)',
    description: 'Powers AI conversations and the intelligent workspace management.',
    required: true,
    url: 'https://console.anthropic.com/settings/keys',
    urlLabel: 'Get Anthropic API Key',
    placeholder: 'sk-ant-api03-...',
    helpText: 'Create a free account, then generate an API key. You get $5 free credits to start.',
  },
  {
    id: 'fal',
    title: 'FAL.ai (Image Generation)',
    description: 'Generates character portraits. Fast and affordable (~$0.01/image).',
    required: false,
    url: 'https://fal.ai/dashboard/keys',
    urlLabel: 'Get FAL API Key',
    placeholder: 'fal-...',
    helpText: 'Sign up for free, then create an API key. Pay-as-you-go pricing.',
  },
  {
    id: 'elevenLabs',
    title: 'ElevenLabs (Voice)',
    description: 'Gives your AI characters unique voices with text-to-speech.',
    required: false,
    url: 'https://elevenlabs.io/app/settings/api-keys',
    urlLabel: 'Get ElevenLabs API Key',
    placeholder: 'xi-...',
    helpText: 'Free tier includes 10,000 characters/month. Great for trying out voices.',
  },
  {
    id: 'openai',
    title: 'OpenAI (Optional)',
    description: 'Alternative for voice transcription (Whisper) and images (DALL-E).',
    required: false,
    url: 'https://platform.openai.com/api-keys',
    urlLabel: 'Get OpenAI API Key',
    placeholder: 'sk-...',
    helpText: 'Only needed if you prefer OpenAI over FAL.ai for images.',
  },
];

interface SetupWizardProps {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const { setApiKey } = useSettingsStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);

  const step = SETUP_STEPS[currentStep];
  const isLastStep = currentStep === SETUP_STEPS.length - 1;
  const hasRequiredKeys = Boolean(getApiKey('anthropic'));

  const handleSaveKey = useCallback(() => {
    if (keyInput.trim()) {
      setApiKey(step.id, keyInput.trim());
    }
    setKeyInput('');
    setShowKey(false);

    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }, [keyInput, step.id, setApiKey, isLastStep, onComplete]);

  const handleSkip = useCallback(() => {
    setKeyInput('');
    setShowKey(false);

    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }, [isLastStep, onComplete]);

  const handleOpenUrl = useCallback(async () => {
    try {
      await invoke('open_external_url', { url: step.url });
    } catch (err) {
      console.error('Failed to open URL:', err);
    }
  }, [step.url]);

  const canSkip = !step.required;

  return (
    <div className="setup-wizard-overlay">
      <div className="setup-wizard">
        <header className="wizard-header">
          <h1>Welcome to Koe</h1>
          <p>Let's set up your API keys to get started</p>
        </header>

        {/* Progress indicator */}
        <div className="wizard-progress">
          {SETUP_STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`progress-step ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''} ${getApiKey(s.id) ? 'configured' : ''}`}
            >
              <div className="progress-dot">
                {i < currentStep || getApiKey(s.id) ? '✓' : i + 1}
              </div>
              <span className="progress-label">{s.title.split(' ')[0]}</span>
            </div>
          ))}
        </div>

        {/* Current step content */}
        <div className="wizard-content">
          <div className="step-header">
            <h2>
              {step.title}
              {step.required && <span className="required-badge">Required</span>}
              {!step.required && <span className="optional-badge">Optional</span>}
            </h2>
            <p>{step.description}</p>
          </div>

          <div className="step-body">
            <div className="help-text">
              <p>{step.helpText}</p>
            </div>

            <button className="get-key-btn" onClick={handleOpenUrl}>
              <LinkIcon />
              {step.urlLabel}
            </button>

            <div className="key-input-group">
              <label>Paste your API key:</label>
              <div className="key-input-wrapper">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={step.placeholder}
                  className="key-input"
                  autoFocus
                />
                <button
                  className="toggle-visibility"
                  onClick={() => setShowKey(!showKey)}
                  title={showKey ? 'Hide' : 'Show'}
                >
                  {showKey ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {getApiKey(step.id) && !keyInput && (
                <p className="already-configured">✓ Already configured</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <footer className="wizard-footer">
          <div className="footer-left">
            {currentStep > 0 && (
              <button
                className="back-btn"
                onClick={() => setCurrentStep((s) => s - 1)}
              >
                ← Back
              </button>
            )}
          </div>

          <div className="footer-right">
            {canSkip && (
              <button className="skip-btn" onClick={handleSkip}>
                {isLastStep ? 'Skip & Finish' : 'Skip'}
              </button>
            )}

            <button
              className="next-btn"
              onClick={handleSaveKey}
              disabled={step.required && !keyInput.trim() && !getApiKey(step.id)}
            >
              {keyInput.trim() ? 'Save & Continue' : isLastStep ? 'Finish' : 'Next'}
            </button>
          </div>
        </footer>

        {/* Skip all for returning users */}
        {hasRequiredKeys && currentStep === 0 && (
          <div className="skip-all">
            <button onClick={onComplete}>
              I already have keys set up → Skip wizard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 10L10 6M10 6H6M10 6V10" />
      <rect x="2" y="2" width="12" height="12" rx="2" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 2l12 12M6.5 6.5a2 2 0 002.9 2.9M1 8s2.5-5 7-5c1 0 1.9.2 2.7.5M15 8s-1.2 2.5-3.5 4" />
    </svg>
  );
}
