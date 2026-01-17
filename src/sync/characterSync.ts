import * as Y from 'yjs';
import { ydoc } from './yjsProvider';
import type { Character, CharacterUpdate } from '../models/character';

// === Character YJS Map ===

/**
 * Get the YJS map storing all characters
 */
export function getCharactersMap(): Y.Map<Y.Map<unknown>> {
  return ydoc.getMap('characters');
}

/**
 * Convert a YJS Map to a Character object
 */
export function yMapToCharacter(ymap: Y.Map<unknown>): Character {
  return {
    id: ymap.get('id') as string,
    name: ymap.get('name') as string,
    description: ymap.get('description') as string,
    personalityTraits: ymap.get('personalityTraits') as Character['personalityTraits'],
    systemPrompt: ymap.get('systemPrompt') as string,
    voiceSettings: ymap.get('voiceSettings') as Character['voiceSettings'],
    appearance: ymap.get('appearance') as Character['appearance'],
    isActive: ymap.get('isActive') as boolean | undefined,
    createdAt: ymap.get('createdAt') as string,
    modifiedAt: ymap.get('modifiedAt') as string,
  };
}

/**
 * Convert a Character object to a YJS Map
 */
function characterToYMap(character: Character): Y.Map<unknown> {
  const ymap = new Y.Map<unknown>();
  ymap.set('id', character.id);
  ymap.set('name', character.name);
  ymap.set('description', character.description);
  ymap.set('personalityTraits', character.personalityTraits);
  ymap.set('systemPrompt', character.systemPrompt);
  ymap.set('voiceSettings', character.voiceSettings);
  ymap.set('appearance', character.appearance);
  ymap.set('isActive', character.isActive);
  ymap.set('createdAt', character.createdAt);
  ymap.set('modifiedAt', character.modifiedAt);
  return ymap;
}

// === CRUD Operations ===

/**
 * Add a new character to the YJS store
 */
export function addCharacter(character: Character): void {
  const charactersMap = getCharactersMap();
  const ymap = characterToYMap(character);
  charactersMap.set(character.id, ymap);
}

/**
 * Update an existing character in the YJS store
 */
export function updateCharacter(characterId: string, updates: CharacterUpdate): void {
  const charactersMap = getCharactersMap();
  const ymap = charactersMap.get(characterId);
  if (!ymap) {
    console.warn(`Character ${characterId} not found in YJS store`);
    return;
  }

  // Apply updates
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      ymap.set(key, value);
    }
  });

  // Update modification timestamp
  ymap.set('modifiedAt', new Date().toISOString());
}

/**
 * Delete a character from the YJS store
 */
export function deleteCharacter(characterId: string): void {
  const charactersMap = getCharactersMap();
  charactersMap.delete(characterId);
}

/**
 * Get a single character by ID
 */
export function getCharacter(characterId: string): Character | null {
  const charactersMap = getCharactersMap();
  const ymap = charactersMap.get(characterId);
  if (!ymap) return null;
  return yMapToCharacter(ymap);
}

/**
 * Get all characters from the YJS store
 */
export function getAllCharacters(): Character[] {
  const charactersMap = getCharactersMap();
  const characters: Character[] = [];
  charactersMap.forEach((ymap) => {
    characters.push(yMapToCharacter(ymap));
  });
  // Sort by modification date (most recent first)
  return characters.sort(
    (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
  );
}

/**
 * Get the currently active character
 */
export function getActiveCharacter(): Character | null {
  const characters = getAllCharacters();
  return characters.find((c) => c.isActive) || null;
}

/**
 * Set a character as active (deactivates all others)
 */
export function setActiveCharacter(characterId: string | null): void {
  const charactersMap = getCharactersMap();

  // Deactivate all characters
  charactersMap.forEach((ymap) => {
    if (ymap.get('isActive')) {
      ymap.set('isActive', false);
      ymap.set('modifiedAt', new Date().toISOString());
    }
  });

  // Activate the specified character
  if (characterId) {
    const ymap = charactersMap.get(characterId);
    if (ymap) {
      ymap.set('isActive', true);
      ymap.set('modifiedAt', new Date().toISOString());
    }
  }
}

// === Subscriptions ===

/**
 * Subscribe to changes in the characters map
 * Returns a cleanup function to unsubscribe
 */
export function onCharactersChange(callback: (characters: Character[]) => void): () => void {
  const charactersMap = getCharactersMap();
  const handler = () => callback(getAllCharacters());
  charactersMap.observeDeep(handler);
  return () => charactersMap.unobserveDeep(handler);
}

// === Utility Functions ===

/**
 * Check if a character name is already taken
 */
export function isNameTaken(name: string, excludeId?: string): boolean {
  const characters = getAllCharacters();
  return characters.some(
    (c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== excludeId
  );
}

/**
 * Get the count of characters
 */
export function getCharacterCount(): number {
  const charactersMap = getCharactersMap();
  return charactersMap.size;
}

/**
 * Search characters by name or description
 */
export function searchCharacters(query: string): Character[] {
  const characters = getAllCharacters();
  const lowerQuery = query.toLowerCase();
  return characters.filter(
    (c) =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Export all characters as JSON for backup
 */
export function exportCharacters(): string {
  const characters = getAllCharacters();
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      characters,
    },
    null,
    2
  );
}

/**
 * Import characters from JSON backup
 */
export function importCharacters(
  json: string,
  mode: 'merge' | 'replace'
): { imported: number; skipped: number } {
  const data = JSON.parse(json);

  if (!data.characters || !Array.isArray(data.characters)) {
    throw new Error('Invalid characters backup format');
  }

  let imported = 0;
  let skipped = 0;

  if (mode === 'replace') {
    // Clear existing characters
    const charactersMap = getCharactersMap();
    charactersMap.clear();
  }

  for (const character of data.characters) {
    // Validate required fields
    if (!character.id || !character.name) {
      skipped++;
      continue;
    }

    // Check for duplicates in merge mode
    if (mode === 'merge' && getCharacter(character.id)) {
      skipped++;
      continue;
    }

    // Add character
    addCharacter({
      ...character,
      isActive: false, // Don't import active state
      modifiedAt: new Date().toISOString(),
    });
    imported++;
  }

  return { imported, skipped };
}
