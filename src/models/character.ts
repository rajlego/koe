// Character types for Koe AI characters

/**
 * Voice settings for ElevenLabs TTS integration
 */
export interface VoiceSettings {
  /** ElevenLabs voice ID (e.g., "21m00Tcm4TlvDq8ikWAM" for Rachel) */
  voiceId: string;
  /** Display name for the voice */
  voiceName: string;
  /** Voice stability (0-1) - lower = more expressive, higher = more consistent */
  stability: number;
  /** Voice similarity boost (0-1) - higher = more similar to original voice */
  similarityBoost: number;
  /** Voice style (0-1) - how much style to apply (optional, ElevenLabs v2 only) */
  style?: number;
  /** Use speaker boost for clearer audio */
  useSpeakerBoost?: boolean;
}

/**
 * Visual appearance settings for AI image generation
 */
export interface AppearanceSettings {
  /** Text description for image generation prompts */
  description: string;
  /** Art style preference (e.g., "realistic", "anime", "oil painting") */
  artStyle?: string;
  /** Pre-generated portrait image URL or base64 data */
  portraitUrl?: string;
  /** Color theme associated with this character */
  accentColor?: string;
}

/**
 * Personality trait with intensity
 */
export interface PersonalityTrait {
  /** Trait name (e.g., "curious", "analytical", "empathetic") */
  trait: string;
  /** Intensity of the trait (0-1, where 1 is most intense) */
  intensity: number;
}

/**
 * A complete AI character definition
 */
export interface Character {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Brief description of who this character is */
  description: string;
  /** Array of personality traits with intensity values */
  personalityTraits: PersonalityTrait[];
  /** System prompt instructing the LLM how to behave as this character */
  systemPrompt: string;
  /** Voice settings for TTS */
  voiceSettings: VoiceSettings;
  /** Visual appearance settings */
  appearance: AppearanceSettings;
  /** Whether this character is currently active/selected */
  isActive?: boolean;
  /** Creation timestamp */
  createdAt: string;
  /** Last modification timestamp */
  modifiedAt: string;
}

/**
 * Input for creating a new character (without auto-generated fields)
 */
export type CharacterInput = Omit<Character, 'id' | 'createdAt' | 'modifiedAt'>;

/**
 * Partial update for an existing character
 */
export type CharacterUpdate = Partial<Omit<Character, 'id' | 'createdAt'>>;

/**
 * Default voice settings for new characters
 */
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceId: '',
  voiceName: 'Default',
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: true,
};

/**
 * Default appearance settings for new characters
 */
export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  description: '',
  artStyle: 'realistic',
  portraitUrl: undefined,
  accentColor: '#06d6a0',
};

/**
 * Create default character input with minimal required fields
 */
export function createDefaultCharacterInput(name: string): CharacterInput {
  return {
    name,
    description: '',
    personalityTraits: [],
    systemPrompt: `You are ${name}. Respond as this character would, maintaining their personality and speaking style.`,
    voiceSettings: { ...DEFAULT_VOICE_SETTINGS },
    appearance: { ...DEFAULT_APPEARANCE_SETTINGS },
    isActive: false,
  };
}

/**
 * Generate a system prompt based on character traits
 */
export function generateSystemPromptFromTraits(
  name: string,
  description: string,
  traits: PersonalityTrait[]
): string {
  const traitDescriptions = traits
    .filter((t) => t.intensity > 0.3)
    .sort((a, b) => b.intensity - a.intensity)
    .map((t) => {
      if (t.intensity > 0.7) return `very ${t.trait}`;
      if (t.intensity > 0.5) return t.trait;
      return `somewhat ${t.trait}`;
    })
    .join(', ');

  const prompt = `You are ${name}. ${description}

Your personality is ${traitDescriptions || 'balanced and adaptable'}.

When responding:
- Stay in character at all times
- Use speech patterns and vocabulary appropriate for this character
- Draw on the character's knowledge, experiences, and worldview
- Be consistent with the character's established traits and mannerisms`;

  return prompt;
}

/**
 * Common personality traits for character creation
 */
export const COMMON_TRAITS = [
  'analytical',
  'creative',
  'curious',
  'empathetic',
  'enthusiastic',
  'formal',
  'humorous',
  'intellectual',
  'mysterious',
  'optimistic',
  'patient',
  'philosophical',
  'pragmatic',
  'reserved',
  'scientific',
  'skeptical',
  'witty',
  'warm',
] as const;

export type CommonTrait = (typeof COMMON_TRAITS)[number];

/**
 * Pre-defined voice options (ElevenLabs voices)
 */
export const ELEVENLABS_VOICES = [
  { voiceId: '21m00Tcm4TlvDq8ikWAM', voiceName: 'Rachel - Calm, Young Female' },
  { voiceId: 'AZnzlk1XvdvUeBnXmlld', voiceName: 'Domi - Confident Female' },
  { voiceId: 'EXAVITQu4vr4xnSDxMaL', voiceName: 'Bella - Soft Female' },
  { voiceId: 'ErXwobaYiN019PkySvjV', voiceName: 'Antoni - Well-rounded Male' },
  { voiceId: 'MF3mGyEYCl7XYWbV9V6O', voiceName: 'Elli - Young Female' },
  { voiceId: 'TxGEqnHWrfWFTfGW9XjX', voiceName: 'Josh - Deep Male' },
  { voiceId: 'VR6AewLTigWG4xSOukaG', voiceName: 'Arnold - Crisp Male' },
  { voiceId: 'pNInz6obpgDQGcFmaJgB', voiceName: 'Adam - Deep Male' },
  { voiceId: 'yoZ06aMxZJJ28mfd3POQ', voiceName: 'Sam - Raspy Male' },
] as const;
