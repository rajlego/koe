import type { VoiceState } from '../../models/types';
import './VoiceIndicator.css';

interface VoiceIndicatorProps {
  state: VoiceState;
  size?: 'small' | 'normal';
}

export default function VoiceIndicator({ state, size = 'normal' }: VoiceIndicatorProps) {
  return (
    <div className={`voice-indicator ${state} ${size}`}>
      <div className="voice-dot" />
      <span className="voice-label">
        {state === 'listening' && 'Listening'}
        {state === 'processing' && 'Processing'}
        {state === 'idle' && 'Idle'}
        {state === 'error' && 'Error'}
      </span>
    </div>
  );
}
