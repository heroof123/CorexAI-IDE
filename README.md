# 🚀 CorexAI IDE

**AI-Powered Code Editor** - Modern, fast, and intelligent development environment built with Tauri, React, and Rust

[![Stars](https://img.shields.io/github/stars/heroof123/CorexAI?style=social)](https://github.com/heroof123/CorexAI)
[![Forks](https://img.shields.io/github/forks/heroof123/CorexAI?style=social)](https://github.com/heroof123/CorexAI)
[![License](https://img.shields.io/github/license/heroof123/CorexAI)](https://github.com/heroof123/CorexAI/blob/main/LICENSE)
[![Issues](https://img.shields.io/github/issues/heroof123/CorexAI)](https://github.com/heroof123/CorexAI/issues)

![Version](https://img.shields.io/badge/version-1.0.0-brightgreen)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![React](https://img.shields.io/badge/React-19-61dafb)
![Rust](https://img.shields.io/badge/Rust-2021-orange)

> A lightweight, privacy-focused IDE with local AI capabilities. No cloud required, your code stays on your machine.

---

## ✨ Features

### 🤖 AI Integration

- **Local LLM Support** - LM Studio, Ollama, GGUF models
- **Advanced GGUF Engine** - Native llama-cpp integration with auto-VRAM estimation and GPU/CPU fallback
- **Smart Code Completion** - Context-aware suggestions using RAG (Retrieval Augmented Generation)
- **Autonomous Agent** - Multi-step planning and execution for complex refactors
- **Privacy First** - All AI processing stays on your machine

### 📝 Editor

- **Monaco Editor** - Full VS Code-like experience
- **AI-Native Editing** - Automated fixes, diff-based code application with safety backups
- **Universal Syntax** - Tree-sitter powered analysis for 100+ languages
- **Intelligent Navigation** - Symbol-based search and project-wide reference tracking

### 🔧 Development Tools

- **Git Integration** - Visual diffs, commit history, and automated summaries
- **Integrated Terminal** - AI-connected terminal with safe command execution
- **RAG Pipeline** - Vector database (LanceDB) powered codebase indexing
- **Task Kanban** - Automated task extraction from comments (TODO/FIXME)

### 🎨 User Interface

- **Premium Glassmorphism** - Futuristic translucent panels and neon accents
- **Ultra-Responsive** - Throttled/debounced UI for peak performance
- **Visual Project Graph** - Dynamic structure visualization
- **Accessibility** - High contrast themes and clear typography

### 🌌 The Singularity & Futuristic Arsenal

- **The Singularity Engine** - An autonomous self-modifying, self-healing core. The IDE can write, compile, and upgrade its own source code on the fly without human intervention.
- **The Startup Generator** - A majestical AI architect that takes a single idea and autonomously scaffolds an entire production-ready project (routing, UI, configurations) into existence.
- **What-If Sandbox (Quantum Universe)** - Simulate parallel coding dimensions. "What if we rewrote this in Rust?" - the IDE simulates the entire universe and reports the outcome before you hit save.
- **Legacy Whisperer & Code Oracle** - AI Archeology engine to decrypt ancient codebases, and speculative pre-bug prophecy tracking to catch errors before you even type them.
- **Impregnable Defense** - Protected by a fortress of autonomous test shields (40+ CI suites) ensuring AI agents cannot destroy the core while rewriting it.

---

- **v1.0.0 Release (Milestone Complete)**:
  - 🔌 **Full MCP Integration**: Tool-calling support for local/remote servers.
  - 🧩 **Extension Marketplace**: Browse and manage plugins with a premium UI.
  - 🎓 **Interactive Academy**: Personal AI tutor analyzing your code.
  - ⚔️ **Model Roulette**: Side-by-side multi-LLM comparison arena.
  - 📚 **Stable API**: Dedicated documentation for extension developers.
- **Robust GGUF Support**: Fixed context length issues and optimized batch processing.
- **Security Hardening**: Secure storage for all API keys, shell injection protection, and safe terminal commands.
- **RAG Optimization**: Vector DB distance-based filtering and smart code chunking for 10x better context.
- **UX Excellence**: Premium button styles, smooth animations, and zero-latency chat interface.
- **Stability Core**: Integrated file recovery mechanism (Safety Backups) before any AI-driven file edit.
- **Memory Safety**: Global AudioContext management and efficient resource unloading.
- 🌌 **The Singularity Engine (New in v1.0.0)**: IDE can completely modify its own codebase, predict future technical debt, and compile speculatively.
- 🧿 **Futuristic Arsenal**: Over 15 built-in advanced SCI-FI tools including *Legacy Whisperer*, *Git-Style Chat Branches*, *Blackhole GC*, *Polyglot Engine*, and *Code Oracle*.

---

## 📦 Installation

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Rust** 1.70+ ([Install](https://rustup.rs/))
- **Git** ([Download](https://git-scm.com/))

### Quick Start

```bash
# Clone repository
git clone https://github.com/heroof123/CorexAI.git
cd CorexAI

# Install dependencies
npm install

# Setup environment (optional - only for OAuth features)
cp .env.example .env
# Edit .env with your OAuth credentials if needed

# Run development server
npm run tauri:dev
```

#### Platform-Specific Notes

**Windows (PowerShell or CMD):**

```cmd
git clone https://github.com/heroof123/CorexAI.git
cd CorexAI
npm install
npm run tauri:dev
```

**Linux/macOS:**

```bash
git clone https://github.com/heroof123/CorexAI.git
cd CorexAI
npm install
npm run tauri:dev
```

**Note:** All npm commands work the same across all platforms.

### Build for Production

#### Build Options

**Default Build (Vulkan-enabled, recommended for AMD/Intel/most users)**

```bash
npm run tauri:build
```

Vulkan backend is enabled by default, no extra setup required. Works on most systems.

**CPU-Only Build (No GPU acceleration)**

```bash
npm run tauri:build:cpu
```

Pure CPU inference, slowest but most compatible.

**CUDA Build (NVIDIA GPU acceleration)**

```bash
npm run tauri:build:cuda
```

Requires NVIDIA GPU and CUDA toolkit installed. Fastest for NVIDIA users.

**Output:** `src-tauri/target/release/`

#### Windows Users

All commands work the same in PowerShell or Command Prompt:

```cmd
npm run tauri:build
```

**Common Commands:**

```cmd
# Development
npm run tauri:dev

# Build
npm run tauri:build

# Clean build artifacts
npm run clean

# Type check
npm run type-check

# Run tests
npm test
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# OAuth (Optional - for account features)
VITE_GITHUB_CLIENT_ID=your_github_client_id
VITE_MICROSOFT_CLIENT_ID=your_microsoft_client_id
```

**Backend (Rust):**

```bash
export GITHUB_CLIENT_SECRET="your_secret"
export MICROSOFT_CLIENT_SECRET="your_secret"
```

### AI Models

1. **LM Studio** (Recommended)
   - Download: [lmstudio.ai](https://lmstudio.ai/)
   - Start local server on `http://localhost:1234`
   - Load any GGUF model

2. **Ollama**
   - Download: [ollama.ai](https://ollama.ai/)
   - Run: `ollama serve`
   - Pull models: `ollama pull llama3` or `ollama pull qwen2.5-coder`

3. **GGUF Direct**
   - Download GGUF models from HuggingFace
   - Load directly in CorexAI (CPU, Vulkan, or CUDA)

---

## 🎯 Usage

### 1. Open a Project

```
File → Open Folder → Select your project
```

The IDE will automatically:

- Index all files
- Analyze project structure
- Enable AI features

### 2. Chat with AI

```
Click AI icon → Type your question
```

Examples:

- "Explain this function"
- "Find bugs in this file"
- "Refactor this code"
- "Add error handling"

### 3. Git Operations

```
Source Control icon → Stage → Commit → Push
```

### 4. Run Tasks

```
Tasks icon → Add Task → Set priority → Track progress
```

---

## 🏗️ Architecture

```
corex/
├── src/                    # Frontend (React + TypeScript)
│   ├── components/         # UI components
│   ├── services/           # Business logic
│   ├── contexts/           # React contexts
│   └── types/              # TypeScript types
├── src-tauri/              # Backend (Rust)
│   └── src/
│       ├── commands.rs     # Tauri commands
│       ├── gguf.rs         # GGUF model support
│       └── oauth.rs        # OAuth authentication
└── docs/                   # Documentation
```

### Tech Stack

**Frontend:**

- React 19
- TypeScript 5.8
- Tailwind CSS
- Monaco Editor
- Xenova Transformers

**Backend:**

- Tauri 2
- Rust 2021
- llama.cpp (via llama-cpp-rs)
- reqwest

---

## 📚 Documentation

- [Installation Guide](docs/INSTALLATION.md)
- [OAuth Setup](docs/OAUTH-SETUP-GUIDE.md)
- [System Analysis](docs/SYSTEM-ANALYSIS-REPORT.md)
- [Fixes Applied](docs/FIXES-APPLIED.md)
- [Quick Fixes](docs/QUICK-FIXES.md)
- [Performance](docs/PERFORMANCE-OPTIMIZATIONS.md)

---

## 🐛 Troubleshooting

### Build Errors

**CUDA not found:**

```bash
# Build without CUDA (CPU-only)
cargo build

# Build with CUDA (NVIDIA GPU)
cargo build --features cuda
```

**Node modules error:**

```bash
rm -rf node_modules package-lock.json
npm install
```

### Runtime Errors

**AI not responding:**

- Check LM Studio is running
- Verify model is loaded
- Check AI Settings panel

**OAuth not working:**

- Verify .env file exists
- Check client ID/secret
- Ensure callback URL matches

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests (if applicable)
5. Submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Use meaningful commit messages
- Add JSDoc comments
- Update documentation

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file

---

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/) - Desktop app framework
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor
- [llama.cpp](https://github.com/ggerganov/llama.cpp) - LLM inference
- [Xenova Transformers](https://github.com/xenova/transformers.js) - Embeddings

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/heroof123/CorexAI/issues)
- **Discussions:** [GitHub Discussions](https://github.com/heroof123/CorexAI/discussions)

## 🌟 Why CorexAI?

- **Privacy First** - All AI processing happens locally, your code never leaves your machine
- **Lightweight** - Fast startup, low memory usage compared to Electron-based IDEs
- **Flexible AI** - Use any local LLM (LM Studio, Ollama, GGUF files)
- **Modern Stack** - Built with latest React 19, TypeScript 5.8, and Tauri 2
- **Cross-Platform** - Native performance on Windows, macOS, and Linux
- **Open Source** - MIT licensed, community-driven development

---

## 🗺️ Roadmap

### v0.2.x

- [x] Professional Light Theme implementation [x]
- [x] Visual Project Graph visualization [x]
- [x] Enhanced GGUF Model Browser & Context Fixes [x]
- [x] AI Knowledge Base (.corexrules support) [x]
- [x] Plugin system (Full Release) [x]
- [x] Automated Test generation & execution [x]
- [x] MCP (Model Context Protocol) Integration [x]

### v1.0.0 (Release)

- [x] Stable API [x]
- [x] Full documentation [x]
- [x] Performance optimizations [x]
- [x] Extension marketplace [x]
- [x] Interactive Academy [x]
- [x] Model Roulette (Arena) [x]

### v1.1.0 - Advanced Intelligence (Genişletilmiş Evren) - [Aktif]

- [x] **The Singularity Engine:** Kendi kodunu değiştirebilen devasa otonom sistem.
- [x] **The Startup Generator:** Tek bir satır fikir ile koca bir şirket/proje kodlayan mimar yapay zeka.
- [x] **What-If Sandbox:** Paralel evrenlerde kod simülasyonu çalıştıran quantum motoru.
- [x] **Aşılmaz Kalkanlar:** Yapay zekanın core çökertmesini engelleyen 40+ otonom test duvarı ve güvenlik mimarisi.
- [x] **Gelişmiş Ajan Döngüsü:** MCP araçları ile tam otonom görev yönetimi ve terminal entegrasyonu.
- [x] **Sesli Kontrol:** Web Speech API ile eller serbest AI yönetimi.
- [x] **Futuristic Arsenal:** 15+ sci-fi konsept (Git-Style Chat Branches, Legacy Whisperer, vb.)

### v1.2.0 - Team & Remote (Planlanan)

- [x] **Remote Development:** SSH/Docker üzerinden uzaktan kodlama.
- [ ] **Collaborative Coding:** Canlı ortak çalışma modu.
- [ ] **AI Pair Review:** Pull Request'ler için otomatik AI inceleme asistanı.

---
*CorexAI ekibi by heroof123*

## 📊 Project Status

This project is in active development. Core features are functional but expect some rough edges. Contributions and feedback are highly appreciated!

---

## ⭐ Star History

**If you find CorexAI useful, please give it a star!** ⭐

It helps the project grow and motivates us to keep improving it.

[![Star History Chart](https://api.star-history.com/svg?repos=heroof123/CorexAI&type=Date)](https://star-history.com/#heroof123/CorexAI&Date)

---

## 📸 Screenshots & Demo

### 🎥 Demo Video

<https://github.com/user-attachments/assets/5b4bf839-1704-49b4-bae4-0b9d4f5910a6>

### 📷 Screenshots

#### Main Interface

![CorexAI Main Interface](https://github.com/user-attachments/assets/9a24992e-30b1-4015-998b-48978247eb38)

#### AI Chat Panel

![AI Chat Panel](https://github.com/user-attachments/assets/c30b9f58-e302-4ab6-a1d0-0e30c5ab5b41)

#### Code Editor

![Code Editor](https://github.com/user-attachments/assets/4c908837-49cd-40f0-b528-509d76b0ad38)

#### Features Overview

![Features](https://github.com/user-attachments/assets/c55e346d-c281-48ca-b5d2-39e62ec3d853)

#### Settings Panel

![Settings](https://github.com/user-attachments/assets/200c79ca-8e21-4fc9-a6af-ad9971b8ef0b)

#### Additional View

![Additional View](https://github.com/user-attachments/assets/60609853-1da5-4dc3-ac16-2dbc6cbc89ec)

## 🔒 Security

- All AI processing is local - no data sent to external servers
- OAuth tokens are stored securely using OS keychain
- No telemetry or tracking
- Open source - audit the code yourself

## 💡 Tips

- Use `Ctrl+P` (or `Cmd+P` on Mac) for quick file navigation
- Press `Ctrl+Shift+P` for command palette
- Right-click in editor for context menu
- Drag and drop files to open them

---

**Made with ❤️ by the CorexAI Team**
