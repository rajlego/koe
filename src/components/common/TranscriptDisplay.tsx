import './TranscriptDisplay.css';

interface TranscriptDisplayProps {
  transcript: string;
  streamingResponse?: string;
  isListening: boolean;
  isProcessing: boolean;
}

export default function TranscriptDisplay({
  transcript,
  streamingResponse,
  isListening,
  isProcessing,
}: TranscriptDisplayProps) {
  return (
    <div className={`transcript-display ${isListening ? 'listening' : ''} ${isProcessing ? 'processing' : ''}`}>
      {/* User transcript */}
      {transcript && (
        <div className="transcript-user">
          <span className="transcript-label">You</span>
          <p className="transcript-text">{transcript}</p>
        </div>
      )}

      {/* Streaming response from AI */}
      {streamingResponse && (
        <div className="transcript-assistant">
          <span className="transcript-label">Koe</span>
          <p className="transcript-text streaming">{streamingResponse}</p>
        </div>
      )}

      {/* Placeholder when nothing is happening */}
      {!transcript && !streamingResponse && (
        <p className="transcript-placeholder">
          {isListening ? 'Speak to think...' : 'Voice input will appear here'}
        </p>
      )}

      {/* Processing indicator */}
      {isProcessing && !streamingResponse && <div className="processing-indicator" />}
    </div>
  );
}
