# Koe

**Koe** (Japanese for "voice") is a voice-first thinking app. Speak to think through problems, and the app creates visual "thought windows" you can manipulate with voice commands.

## Features

- **Voice-First Interface** - Speak naturally to capture and organize your thoughts
- **Thought Windows** - Visual workspace with multiple draggable thought windows
- **AI-Powered** - Claude API interprets your voice and manages your workspace
- **Offline-First** - Works without network; all data stored locally using CRDTs
- **Cloud Sync** - Optional Firebase sync for multi-device access
- **Keyboard Shortcuts** - Full keyboard navigation for power users
- **Dark Theme** - Terminal-inspired aesthetic with monospace typography

## Screenshots

<!-- TODO: Add screenshots -->

## Tech Stack

- **Framework**: [Tauri 2.0](https://tauri.app/) (Rust backend + web frontend)
- **Frontend**: React 19 + TypeScript (strict mode)
- **Build Tool**: Vite 7
- **State Management**: Zustand
- **Data Sync**: Yjs (CRDT) + y-indexeddb for offline-first storage
- **Cloud Sync**: Firebase Firestore (optional)
- **Voice**: Whisper API for transcription
- **LLM**: Claude API with tool use
- **Testing**: Vitest (unit) + Playwright (E2E)

## Prerequisites

- **Node.js** 18+ and npm
- **Rust** (for Tauri) - Install via [rustup](https://rustup.rs/)
- **Anthropic API Key** - Required for LLM features ([get one here](https://console.anthropic.com/))
- **OpenAI API Key** - Required for voice transcription via Whisper API

### Platform-Specific Requirements

#### macOS
```bash
xcode-select --install
```

#### Linux
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

#### Windows
- Install [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/koe.git
   cd koe
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` and add your API keys**
   ```
   VITE_ANTHROPIC_API_KEY=your-anthropic-api-key
   VITE_OPENAI_API_KEY=your-openai-api-key
   ```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude LLM features |
| `VITE_OPENAI_API_KEY` | Yes | OpenAI API key for Whisper voice transcription |
| `VITE_FIREBASE_API_KEY` | No | Firebase API key for cloud sync |
| `VITE_FIREBASE_AUTH_DOMAIN` | No | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | No | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | No | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | No | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | No | Firebase app ID |

## Development

### Start Development Server

**Frontend only** (faster reload, no native features):
```bash
npm run dev
```

**Full desktop app** (includes Rust backend):
```bash
npm run tauri dev
```

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (frontend only) |
| `npm run tauri dev` | Run full desktop app in dev mode |
| `npm run build` | Build frontend for production |
| `npm run tauri build` | Build desktop binary |
| `npm run preview` | Preview production build |

## Testing

### Unit Tests
```bash
npm run test          # Run once
npm run test:watch    # Watch mode
npm run test:ui       # Interactive UI
```

### E2E Tests
```bash
npm run test:e2e      # Run Playwright tests
```

### All Tests
```bash
npm run test:all      # Unit + E2E
```

## Building for Production

```bash
npm run tauri build
```

This creates platform-specific binaries in `src-tauri/target/release/bundle/`.

## Architecture

```
koe/
├── src/                    # Frontend (React + TypeScript)
│   ├── components/
│   │   ├── common/         # VoiceIndicator, TranscriptDisplay, ThoughtList
│   │   ├── ControlSurface/ # Main control window
│   │   └── ThoughtWindow/  # Individual thought display
│   ├── hooks/
│   │   ├── useVoice.ts     # Voice capture hook
│   │   └── useWindows.ts   # Window management
│   ├── services/
│   │   ├── llm.ts          # Claude API with tools
│   │   └── tts.ts          # Text-to-speech
│   ├── store/
│   │   ├── settingsStore.ts # User preferences
│   │   └── windowStore.ts   # Runtime window state
│   ├── sync/
│   │   ├── yjsProvider.ts   # Yjs CRDT setup
│   │   └── firebaseSync.ts  # Cloud sync
│   ├── models/
│   │   └── types.ts         # TypeScript interfaces
│   └── styles/
│       └── globals.css      # CSS variables, base styles
├── src-tauri/              # Backend (Rust)
│   └── src/
│       ├── lib.rs          # Tauri commands
│       ├── main.rs         # Entry point
│       └── voice.rs        # Voice capture
├── e2e/                    # Playwright E2E tests
└── tests/                  # Vitest unit tests
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Esc` | Toggle voice listening |
| `Cmd+N` | Create new thought |
| `Cmd+W` | Close current window |
| `Cmd+,` | Open settings |
| `Cmd+Shift+V` | Toggle voice enabled |

## Core Concepts

- **Thought**: A piece of content (note, list, outline) displayed in a window
- **Control Surface**: Main window showing voice status, recent thoughts, and actions
- **Thought Window**: Individual window displaying a single thought
- **LLM-as-Controller**: Claude interprets voice input and executes tools to manage your workspace

## LLM Tools

The app uses Claude with these tools:
- `create_thought` - Create a new thought window
- `update_thought` - Update existing thought content
- `move_window` - Move window to position preset
- `close_window` - Close a window
- `condense` - Summarize a thought
- `generate_list` - Create a list from conversation

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.
