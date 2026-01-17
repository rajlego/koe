import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Character,
  CharacterInput,
  CharacterUpdate,
} from '../models/character';
import {
  addCharacter as addCharacterToYjs,
  updateCharacter as updateCharacterInYjs,
  deleteCharacter as deleteCharacterFromYjs,
  getAllCharacters,
  onCharactersChange,
} from '../sync/characterSync';

interface CharacterStoreState {
  // Characters list
  characters: Character[];

  // Currently selected/active character
  activeCharacterId: string | null;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Actions
  setCharacters: (characters: Character[]) => void;
  addCharacter: (input: CharacterInput) => Character;
  updateCharacter: (id: string, updates: CharacterUpdate) => void;
  deleteCharacter: (id: string) => void;
  setActiveCharacter: (id: string | null) => void;
  getCharacter: (id: string) => Character | undefined;
  getActiveCharacter: () => Character | undefined;
  duplicateCharacter: (id: string) => Character | null;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;

  // Sync with YJS
  syncFromYjs: () => void;
  initSync: () => () => void;
}

// Generate unique ID
function generateId(): string {
  return `char_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const useCharacterStore = create<CharacterStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      characters: [],
      activeCharacterId: null,
      isLoading: false,
      error: null,

      // Set characters (used by YJS sync)
      setCharacters: (characters) => set({ characters }),

      // Add new character
      addCharacter: (input) => {
        const now = new Date().toISOString();
        const character: Character = {
          ...input,
          id: generateId(),
          createdAt: now,
          modifiedAt: now,
        };

        // Add to YJS (source of truth)
        addCharacterToYjs(character);

        // Update local state
        set((state) => ({
          characters: [...state.characters, character],
        }));

        return character;
      },

      // Update existing character
      updateCharacter: (id, updates) => {
        const character = get().characters.find((c) => c.id === id);
        if (!character) {
          set({ error: `Character with id ${id} not found` });
          return;
        }

        const updatedCharacter: Character = {
          ...character,
          ...updates,
          modifiedAt: new Date().toISOString(),
        };

        // Update in YJS
        updateCharacterInYjs(id, updates);

        // Update local state
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === id ? updatedCharacter : c
          ),
        }));
      },

      // Delete character
      deleteCharacter: (id) => {
        // Delete from YJS
        deleteCharacterFromYjs(id);

        // Update local state
        set((state) => ({
          characters: state.characters.filter((c) => c.id !== id),
          // Clear active if deleted
          activeCharacterId:
            state.activeCharacterId === id ? null : state.activeCharacterId,
        }));
      },

      // Set active character
      setActiveCharacter: (id) => {
        // Deactivate previous character
        const { activeCharacterId, characters } = get();
        if (activeCharacterId && activeCharacterId !== id) {
          const prevChar = characters.find((c) => c.id === activeCharacterId);
          if (prevChar) {
            updateCharacterInYjs(activeCharacterId, { isActive: false });
          }
        }

        // Activate new character
        if (id) {
          const newChar = characters.find((c) => c.id === id);
          if (newChar) {
            updateCharacterInYjs(id, { isActive: true });
          }
        }

        set({ activeCharacterId: id });
      },

      // Get character by ID
      getCharacter: (id) => {
        return get().characters.find((c) => c.id === id);
      },

      // Get currently active character
      getActiveCharacter: () => {
        const { activeCharacterId, characters } = get();
        if (!activeCharacterId) return undefined;
        return characters.find((c) => c.id === activeCharacterId);
      },

      // Duplicate a character
      duplicateCharacter: (id) => {
        const original = get().characters.find((c) => c.id === id);
        if (!original) {
          set({ error: `Character with id ${id} not found` });
          return null;
        }

        const { id: _id, createdAt: _createdAt, modifiedAt: _modifiedAt, ...rest } = original;
        const duplicated = get().addCharacter({
          ...rest,
          name: `${original.name} (Copy)`,
          isActive: false,
        });

        return duplicated;
      },

      // Set error
      setError: (error) => set({ error }),

      // Set loading
      setLoading: (isLoading) => set({ isLoading }),

      // Sync from YJS to local state
      syncFromYjs: () => {
        const characters = getAllCharacters();
        set({ characters });

        // Check if any character is marked as active
        const activeChar = characters.find((c) => c.isActive);
        if (activeChar) {
          set({ activeCharacterId: activeChar.id });
        }
      },

      // Initialize YJS sync and return cleanup function
      initSync: () => {
        // Load initial data from YJS
        get().syncFromYjs();

        // Subscribe to changes
        const unsubscribe = onCharactersChange((characters) => {
          set({ characters });
        });

        return unsubscribe;
      },
    }),
    {
      name: 'koe-characters',
      storage: createJSONStorage(() => localStorage),
      // Only persist activeCharacterId, not the full characters list
      // (characters are persisted via YJS)
      partialize: (state) => ({
        activeCharacterId: state.activeCharacterId,
      }),
    }
  )
);
