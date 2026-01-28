# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**Koe** (Japanese for "voice") is a voice-first thinking app. Users speak to think through problems, and the app creates visual "thought windows" they can manipulate with voice commands.

### Core Concepts

- **Thought**: A piece of content (note, list, outline) displayed in a window
- **Control Surface**: Main window showing voice status, recent thoughts, and actions
- **Thought Window**: Individual window displaying a single thought (can have many open)
- **LLM-as-Controller**: Claude interprets voice input and executes tools to manage the workspace

## Tech Stack

- **Framework**: Tauri 2.0 (Rust backend + web frontend)
- **Frontend**: React 19 with TypeScript (strict mode)
- **State**: Zustand for UI state
- **Sync**: Yjs (CRDT) + y-indexeddb for offline-first, Firebase Firestore for cloud sync (optional)
- **Voice**: Whisper.cpp via Rust (placeholder - to be implemented)
- **LLM**: Claude API with tool use
- **Build**: Vite 7
- **Testing**: Playwright

## Commands

```bash
npm install            # Install dependencies
npm run dev            # Start Vite dev server (frontend only)
npm run tauri dev      # Run full desktop app in dev mode
npm run build          # Build frontend
npm run tauri build    # Build desktop binary
npm run test           # Run Playwright tests
```

## Architecture

```
src/
  components/
    common/           # VoiceIndicator, TranscriptDisplay, ThoughtList
    ControlSurface/   # Main control window
    ThoughtWindow/    # Individual thought display
  hooks/
    useVoice.ts       # Voice capture hook (talks to Rust)
    useWindows.ts     # Window management
  services/
    llm.ts            # Claude API with tools
    tts.ts            # Text-to-speech
  store/
    settingsStore.ts  # User preferences (Zustand + localStorage)
    windowStore.ts    # Runtime window state
  sync/
    yjsProvider.ts    # Yjs CRDT setup
    firebaseSync.ts   # Cloud sync
  models/
    types.ts          # TypeScript interfaces
  styles/
    globals.css       # CSS variables, base styles

src-tauri/
  src/
    lib.rs            # Tauri commands
    main.rs           # Entry point
    voice.rs          # Voice capture (placeholder)
```

## Design System

### Theme
Dark-first terminal aesthetic. Use CSS variables from `:root`:
- `--bg-primary: #0a0a0f` through `--bg-highlight: #22222e`
- `--text-primary: #e0e0e0`, `--text-secondary: #8888aa`
- `--accent-color: #06d6a0` (teal/mint)
- Voice states: `--voice-listening`, `--voice-processing`, `--voice-idle`

### Typography
Monospace only: JetBrains Mono, Fira Code, SF Mono fallbacks. Base 13px.

## Data Models

### Thought
```typescript
interface Thought {
  id: string;
  content: string;
  type: 'note' | 'list' | 'outline';
  createdAt: string;
  modifiedAt: string;
}
```

### WindowState
```typescript
interface WindowState {
  id: string;
  thoughtId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  viewMode: 'full' | 'condensed' | 'title-only';
}
```

## LLM Tools

The Claude API is called with these tools:
- `create_thought` - Create a new thought window
- `update_thought` - Update existing thought content
- `move_window` - Move window to position preset
- `close_window` - Close a window
- `condense` - Summarize a thought
- `generate_list` - Create a list from conversation

## Environment Variables

Create a `.env` file:
```
VITE_ANTHROPIC_API_KEY=your-api-key

# Optional: Firebase sync
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Display Modes

- **Control mode** (default): Main window is control surface, spawns separate thought windows
- **Integrated mode**: Main window shows both control surface and active thought (settable in preferences)

## Key Implementation Notes

1. **Voice is always-on**: App listens continuously when voice is enabled
2. **Offline-first**: Everything works without network; Firebase sync is optional
3. **YJS for data**: All thoughts and window states stored in YJS CRDTs
4. **Zustand for UI**: Ephemeral UI state (voice state, active selections) in Zustand

## Workflow Rules

1. **Commit and push after every major change** — Don't let work pile up. Commit each feature/fix as it's completed and push immediately.
2. **Reinstall the app after changes** — After modifying Rust or frontend code, rebuild and reinstall:
   ```bash
   npm run tauri build
   cp -r src-tauri/target/release/bundle/macos/Koe.app /Applications/
   ```
3. **Run tests before committing** — `cargo test` for Rust, `npx tsc --noEmit` for TypeScript. Integration tests (e.g. API tests) use `-- --ignored` flag.

## Next Steps / TODOs

1. **Improve VAD** - Current voice activity detection is basic (RMS threshold). Consider WebRTC VAD or silero-vad.
2. **Add rewrite tool** - Allow users to say "rewrite this more formally" etc.
3. **Add more LLM tools** - Expand, split, merge thoughts

## Running the App

```bash
cd "/Users/rajthimmiah/Documents/Projects 2/Koe"
npm install
cp .env.example .env
# Add your VITE_ANTHROPIC_API_KEY to .env
npm run tauri dev
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Esc` | Toggle voice listening |
| `Cmd+N` | Create new thought |
| `Cmd+W` | Close current window |
| `Cmd+,` | Open settings |
| `Cmd+Shift+V` | Toggle voice enabled |
