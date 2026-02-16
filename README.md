# 🚀 Corex IDE

**AI-Powered Code Editor** - Modern, fast, and intelligent development environment built with Tauri, React, and Rust

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![React](https://img.shields.io/badge/React-19-61dafb)
![Rust](https://img.shields.io/badge/Rust-2021-orange)

> A lightweight, privacy-focused IDE with local AI capabilities. No cloud required, your code stays on your machine.

---

## ✨ Features

### 🤖 AI Integration
- **Local LLM Support** - LM Studio, Ollama, GGUF models
- **Smart Code Completion** - Context-aware suggestions
- **Code Analysis** - Automatic bug detection and fixes
- **Natural Language** - Chat with your codebase

### 📝 Editor
- **Monaco Editor** - VS Code-like editing experience
- **Multi-tab Support** - Work on multiple files
- **Syntax Highlighting** - 100+ languages
- **Diff Viewer** - Side-by-side comparison

### 🔧 Development Tools
- **Git Integration** - Commit, push, pull, branches
- **Terminal** - Integrated terminal panel
- **Task Manager** - Kanban board for tasks
- **Docker Support** - Container management

### 🌐 Integrations
- **GitHub OAuth** - Sync settings and repos
- **Microsoft OAuth** - OneDrive integration
- **Database Browser** - SQLite, MySQL, PostgreSQL
- **API Testing** - Postman-like REST client

### ⚡ Performance
- **Incremental Indexing** - Only index changed files
- **Smart Caching** - LRU cache for embeddings
- **Batch Processing** - Parallel file operations
- **Memory Efficient** - Automatic cleanup

---

## 📦 Installation

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Rust** 1.70+ ([Install](https://rustup.rs/))
- **Git** ([Download](https://git-scm.com/))

### Quick Start

```bash
# Clone repository
git clone https://github.com/heroof123/CorexA-.git
cd CorexA-

# Install dependencies
npm install

# Setup environment (optional - only for OAuth features)
cp .env.example .env
# Edit .env with your OAuth credentials if needed

# Run development server
npm run tauri:dev
```

**Windows Users:**
```cmd
git clone https://github.com/heroof123/CorexA-.git
cd CorexA-
npm install
npm run tauri:dev
```

### Build for Production

```bash
# Standard build (CPU-only, recommended for most users)
npm run tauri:build

# Build with CUDA support (NVIDIA GPU acceleration)
npm run tauri:build:cuda

# Build with Vulkan support (AMD/Intel GPU)
npm run tauri:build:vulkan

# Output: src-tauri/target/release/
```

**Windows Users:**
```cmd
npm run tauri:build
```
Or use the provided batch files:
```cmd
build.bat    # Standard build
clean.bat    # Clean build artifacts
setup.bat    # Initial setup
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
   - Pull models: `ollama pull llama2`

3. **GGUF Direct**
   - Download GGUF models from HuggingFace
   - Load directly in Corex (CPU or CUDA)

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
- llama-cpp-2
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

- **Issues:** [GitHub Issues](https://github.com/heroof123/CorexA-/issues)
- **Discussions:** [GitHub Discussions](https://github.com/heroof123/CorexA-/discussions)

## 🌟 Why Corex?

- **Privacy First** - All AI processing happens locally, your code never leaves your machine
- **Lightweight** - Fast startup, low memory usage compared to Electron-based IDEs
- **Flexible AI** - Use any local LLM (LM Studio, Ollama, GGUF files)
- **Modern Stack** - Built with latest React 19, TypeScript 5.8, and Tauri 2
- **Cross-Platform** - Native performance on Windows, macOS, and Linux
- **Open Source** - MIT licensed, community-driven development

---

## 🗺️ Roadmap

### v0.2.0 (Next Release)
- [ ] Multi-file refactoring
- [ ] Test generation
- [ ] Code review automation
- [ ] Plugin system
- [ ] Improved AI context management

### v0.3.0
- [ ] Remote development
- [ ] Collaborative editing
- [ ] Enhanced Git features
- [ ] Custom themes marketplace

### v1.0.0
- [ ] Stable API
- [ ] Full documentation
- [ ] Performance optimizations
- [ ] Extension marketplace

## 📊 Project Status

This project is in active development. Core features are functional but expect some rough edges. Contributions and feedback are highly appreciated!

---

## ⭐ Star History

If you find Corex useful, please star the repository!

---

## 📸 Screenshots

> Add screenshots here to showcase your IDE

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

**Made with ❤️ by the Corex Team**

