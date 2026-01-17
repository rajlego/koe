# Koe

**Koe** (Japanese for "voice") is a voice-first thinking app. Speak to think through problems, and the app creates visual "thought windows" you can manipulate with voice commands.

## Download

Download the latest release for your platform:

[![Download](https://img.shields.io/github/v/release/rajlego/koe?label=Download&style=for-the-badge)](https://github.com/rajlego/koe/releases/latest)

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [Koe_x.x.x_aarch64.dmg](https://github.com/rajlego/koe/releases/latest) |
| macOS (Intel) | [Koe_x.x.x_x64.dmg](https://github.com/rajlego/koe/releases/latest) |
| Windows | [Koe_x.x.x_x64-setup.exe](https://github.com/rajlego/koe/releases/latest) |
| Linux (Debian/Ubuntu) | [koe_x.x.x_amd64.deb](https://github.com/rajlego/koe/releases/latest) |
| Linux (AppImage) | [koe_x.x.x_amd64.AppImage](https://github.com/rajlego/koe/releases/latest) |

## Features

- **Voice-First Interface** - Speak naturally to capture and organize your thoughts
- **Thought Windows** - Visual workspace with multiple draggable thought windows
- **AI Characters** - Create and chat with AI characters with unique personalities and voices
- **AI-Powered** - Claude API interprets your voice and manages your workspace
- **Image Generation** - Generate character portraits with FAL.ai, DALL-E, or Stability AI
- **Text-to-Speech** - Characters speak with ElevenLabs voices
- **Offline-First** - Works without network; all data stored locally using CRDTs
- **Cloud Sync** - Optional Firebase sync for multi-device access
- **Keyboard Shortcuts** - Full keyboard navigation for power users
- **Multiple Themes** - Dark, light, midnight blue, forest green, sunset orange

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

## API Keys

**Option 1: In-App Settings (Recommended)**

Open Settings (Cmd+,) and enter your API keys directly. Keys are stored locally on your device.

**Option 2: Environment Variables**

Create a `.env` file for development:
```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude LLM ([get key](https://console.anthropic.com/)) |
| `VITE_OPENAI_API_KEY` | No | OpenAI for Whisper transcription & DALL-E ([get key](https://platform.openai.com/api-keys)) |
| `VITE_FAL_API_KEY` | No | FAL.ai for fast, cheap image gen ([get key](https://fal.ai/dashboard/keys)) |
| `VITE_ELEVENLABS_API_KEY` | No | ElevenLabs for character voices ([get key](https://elevenlabs.io/)) |
| `VITE_STABILITY_API_KEY` | No | Stability AI for image generation |
| `VITE_REPLICATE_API_KEY` | No | Replicate for various AI models |
| `VITE_FIREBASE_*` | No | Firebase config for cloud sync |

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

## Releasing

To create a new release:

```bash
# Bump version and create release
npm run release patch   # 0.1.0 -> 0.1.1
npm run release minor   # 0.1.0 -> 0.2.0
npm run release major   # 0.1.0 -> 1.0.0
npm run release 0.2.0   # Set specific version
```

This will:
1. Update version in `package.json` and `tauri.conf.json`
2. Create a git commit and tag
3. Push to GitHub (triggers automatic build)

GitHub Actions will then:
- Build for macOS (Apple Silicon & Intel), Windows, and Linux
- Create a GitHub Release with downloadable installers
- Generate release notes from commit history

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.
