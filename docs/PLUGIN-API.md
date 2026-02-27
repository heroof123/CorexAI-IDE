# CorexAI Plugin & Extension API Guide (v1.0.0 Stable)

Welcome to the CorexAI Extension API. This document outlines the ways you can extend the IDE's capabilities.

## 🔌 API Architecture

CorexAI provides extensions with access to the editor, file system, and AI services through the `window.tauri` bridge and the internal `PluginService`.

### 📂 File System access

Use the Tauri `fs` plugin or the `PluginService` to interact with files:

```typescript
import { invoke } from "@tauri-apps/api/core";

// Read current project file
const content = await invoke("read_file", { path: "src/App.tsx" });
```

### 🤖 AI Service (Agentic Integration)

You can hook into the AI loop or call models directly:

```typescript
import { callAI } from "./services/aiProvider";

// Direct AI call
await callAI("Refactor this function", "local-model", [], (token) => {
  console.log(token);
});
```

### 🧩 UI Extensions

Extensions can register new views in the `SidePanel` or custom components in the `Marketplace`.

#### Registering a SidePanel view:
1. Add your component to `src/components/`.
2. Register the view ID in `SideBar.tsx` and `SidePanel.tsx`.

### 🛡️ Security Best Practices

- **Local First**: Keep all processing local.
- **Permission Requests**: Use the internal `notify` service to request user confirmation for sensitive actions.
- **Sandboxing**: (Coming in v1.1.0) Logic will be sandboxed in isolated web-workers.

## 📊 Roadmap to v2.0
- [ ] Hot-reload for extensions
- [ ] VS Code Extension compatibility layer
- [ ] Cloud synchronization (optional)
- [ ] Performance-heavy indexing optimization (Rust-side improvements)
