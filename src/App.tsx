import { useEffect, useState, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LayoutProvider } from "./contexts/LayoutContext";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import {
  NotificationProvider,
  useNotifications,
  StatusIndicator,
  notificationHelpers,
} from "./components/NotificationSystem";
import { WorkflowNotification } from "./types/workflow";
import { cacheManager } from "./services/cache";
import { initializeExtension } from "./extension";
import { useCore } from "./hooks/useCore";
import { useLayout } from "./contexts/LayoutContext";
import { useKeyboardShortcuts, createShortcut } from "./hooks/useKeyboardShortcuts";
import { useProjectManager } from "./hooks/useProjectManager";
import { useFileEditor } from "./hooks/useFileEditor";
import { useChatMessages } from "./hooks/useChatMessages";
import { useUIState } from "./hooks/useUIState";
import { useAIBackgroundAnalysis } from "./hooks/useAIBackgroundAnalysis";
import AIProblemsPanel from "./components/AIProblemsPanel";
import { FileIndex } from "./types/index";
import { agentService } from "./services/agentService";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Login } from "./components/auth/Login";
import { ProjectDashboard } from "./components/dashboard/ProjectDashboard";

// Core components (always needed)
import ChatPanel from "./components/chatpanel";
import NotificationToast from "./components/notificationToast";
import ToastContainer from "./components/ToastContainer";
import LoadingSpinner from "./components/LoadingSpinner";
import { SymbolSearchUI } from "./components/SymbolSearchUI";

// Lazy loaded components
const Dashboard = lazy(() => import("./components/Dashboard"));
const ModelComparison = lazy(() => import("./components/ModelComparison"));
const TerminalPanel = lazy(() => import("./components/TerminalPanel"));
const CodeUniversePanel = lazy(() => import("./components/CodeUniversePanel"));

const BrowserPanel = lazy(() => import("./components/BrowserPanel"));
const CommandPalette = lazy(() => import("./components/CommandPalette"));
const QuickFileOpen = lazy(() => import("./components/QuickFileOpen"));
const FindInFiles = lazy(() => import("./components/FindInFiles"));
const BottomPanel = lazy(() => import("./components/BottomPanel"));
const SplitView = lazy(() => import("./components/SplitView"));
const LayoutPresets = lazy(() => import("./components/LayoutPresets"));
const AdvancedSearch = lazy(() => import("./components/AdvancedSearch"));
const EnhancedEditor = lazy(() => import("./components/EnhancedEditor"));
const EnhancedAIPanel = lazy(() => import("./components/EnhancedAIPanel"));
const CodeReviewPanel = lazy(() => import("./components/CodeReviewPanel"));
const GitPanel = lazy(() => import("./components/GitPanel"));
const SettingsPanel = lazy(() => import("./components/SettingsPanel"));
const CustomizeLayout = lazy(() => import("./components/CustomizeLayout"));
const DeveloperTools = lazy(() => import("./components/DeveloperTools"));
const CodeSnippets = lazy(() => import("./components/CodeSnippets"));
// CodeAnalysis modal kaldırıldı — analiz artık sadece status bar + chat içinde görünür
const AdvancedTheming = lazy(() => import("./components/AdvancedTheming"));
const RemoteDevelopment = lazy(() => import("./components/RemoteDevelopment"));
const SidePanel = lazy(() => import("./components/SidePanel"));
const AISettings = lazy(() => import("./components/AISettings"));

// ─────────────────────────────────────────────────────────────────────────────
// AppContent — tüm hook'ları birleştiren composition katmanı
// ─────────────────────────────────────────────────────────────────────────────
function AppContent() {
  const [initError, setInitError] = useState<string | null>(null);
  const { user, loading } = useAuth();
  const ui = useUIState();
  const { t } = useLanguage();
  const { addNotification } = useNotifications();
  const {
    showLeftSidebar,
    showRightSidebar,
    showBottomPanel,
    leftSidebarWidth,
    rightSidebarWidth,
    toggleLeftSidebar,
    toggleRightSidebar,
    toggleBottomPanel,
    toggleZenMode,
    setLeftSidebarVisible,
    setLeftSidebarWidth,
    setRightSidebarWidth,
    isZenMode,
  } = useLayout();

  // Continue.dev Core hook
  const {
    coreMessages,
    isStreaming: isCoreStreaming,
    stopGeneration: stopCoreGeneration,
  } = useCore();

  // Shared file index state (paylaşılan, hook'lar arası)
  const [fileIndex, setFileIndex] = useState<FileIndex[]>([]);

  // Notification helper
  const notify = (
    type: "success" | "error" | "warning" | "info",
    title: string,
    message: string
  ) => {
    addNotification({ type, title, message, duration: 5000 });
  };

  // ── Project Manager ──────────────────────────────────────────────────────
  const project = useProjectManager({
    onMessage: msg => chat.addMessage(msg),
    onNotification: notify,
    fileIndex,
    setFileIndex,
  });

  // ── File Editor ──────────────────────────────────────────────────────────
  const editor = useFileEditor({
    projectPath: project.projectPath,
    fileIndex,
    setFileIndex,
    onMessage: msg => chat.addMessage(msg),
    onNotification: notify,
  });

  // ── Chat Messages ────────────────────────────────────────────────────────
  const chat = useChatMessages({
    projectPath: project.projectPath,
    coreMessages,
    isCoreStreaming,
    stopCoreGeneration,
    openFile: editor.openFile,
    addFileToIndex: project.addFileToIndex,
    currentFile: editor.selectedFile,
    fileIndex,
    cursorLine: editor.cursorPosition.line,
    cursorColumn: editor.cursorPosition.column,
    selection: editor.selection,
  });

  // 🤖 Connect Autonomous Agent to Chat
  useEffect(() => {
    const callback = (msg: any) => {
      chat.addMessage(msg);
      // Otonom ajan mesaj gönderdiğinde chat panelini otomatik açabiliriz?
      if (!showRightSidebar) toggleRightSidebar();
    };

    agentService.registerChatCallback(callback);

    // Cleanup - Eski callback'i temizle
    return () => {
      agentService.unregisterChatCallback(callback);
    };
  }, [chat.addMessage, showRightSidebar, toggleRightSidebar]);

  // ── AI Background Analysis (proaktif — dosya açıldığında otomatik) ────────
  const [isAIReady, setIsAIReady] = useState(false);

  useEffect(() => {
    const checkAI = async () => {
      const { loadAIProviders } = await import("./services/aiProvider");
      const providers = await loadAIProviders();
      setIsAIReady(providers.length > 0);
    };
    checkAI();
  }, []);
  const aiAnalysis = useAIBackgroundAnalysis(editor.selectedFile, editor.fileContent, isAIReady);

  // Workflow notification state
  const [notification, setNotification] = useState<WorkflowNotification | null>(null);

  // ── Initialization ───────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        await initializeExtension();
        console.log("✅ Extension initialized");

        // 🆕 RAG Service Initialization
        const { ragService } = await import("./services/ragService");
        const { appDataDir, join } = await import("@tauri-apps/api/path");
        const appData = await appDataDir();
        const vectorDbPath = await join(appData, "vector_db");
        await ragService.init(vectorDbPath).catch(e => console.warn("RAG Init failed:", e));
      } catch (err: any) {
        console.error("Initialization failed:", err);
        setInitError(err.message || "Bilinmeyen bir hata oluştu");
      }
    };
    init();
  }, []);

  useEffect(() => {
    const initCache = async () => {
      await cacheManager.loadFromDisk();
    };
    initCache();

    const cleanup = async () => {
      cacheManager.saveToDisk();
      try {
        const { unloadGgufModel } = await import("./services/ggufProvider");
        await unloadGgufModel();
      } catch { }
    };

    window.addEventListener("beforeunload", cleanup);
    return () => {
      window.removeEventListener("beforeunload", cleanup);
      cleanup();
    };
  }, []);

  // ── Keyboard Shortcuts ───────────────────────────────────────────────────
  const shortcuts = [
    createShortcut("s", editor.saveFile, "Dosya Kaydet", { ctrl: true }),
    createShortcut("o", project.handleOpenProject, "Proje Aç", { ctrl: true }),
    createShortcut("p", () => ui.setShowQuickFileOpen(true), "Hızlı Dosya Aç", { ctrl: true }),
    createShortcut("f", () => ui.setShowFindInFiles(true), "Dosyalarda Ara", {
      ctrl: true,
      shift: true,
    }),
    createShortcut("P", () => ui.setShowCommandPalette(true), "Komut Paleti", {
      ctrl: true,
      shift: true,
    }),
    createShortcut("`", () => ui.setShowTerminal(p => !p), "Terminal", { ctrl: true }),
    createShortcut("b", () => ui.setShowBrowserPanel(p => !p), "Browser Panel", {
      ctrl: true,
      shift: true,
    }),
    createShortcut("b", toggleLeftSidebar, "Activity Bar", { ctrl: true }),
    createShortcut("a", toggleRightSidebar, "AI Sohbet", { ctrl: true, shift: true }),
    createShortcut("j", toggleBottomPanel, "Alt Panel", { ctrl: true }),
    createShortcut("l", () => ui.setShowLayoutPresets(true), "Düzen Presetleri", {
      ctrl: true,
      shift: true,
    }),
    createShortcut(
      "\\",
      () => {
        if (editor.selectedFile && editor.fileContent)
          ui.openSplitView(editor.selectedFile, editor.fileContent);
      },
      "Bölünmüş Görünüm",
      { ctrl: true }
    ),
    createShortcut("h", () => ui.setShowAdvancedSearch(true), "Gelişmiş Arama", {
      ctrl: true,
      shift: true,
    }),
    createShortcut("e", () => ui.setActiveView("explorer"), "Explorer", {
      ctrl: true,
      shift: true,
    }),
    createShortcut("g", () => ui.setActiveView("source-control"), "Source Control", {
      ctrl: true,
      shift: true,
    }),
    createShortcut("x", () => ui.setActiveView("extensions"), "Extensions", {
      ctrl: true,
      shift: true,
    }),
    createShortcut(",", () => ui.setShowSettingsPanel(true), "Ayarlar", { ctrl: true }),
    createShortcut("k", () => ui.setShowCustomizeLayout(true), "Düzeni Özelleştir", {
      ctrl: true,
      shift: true,
    }),
    createShortcut("d", () => ui.setShowDeveloperTools(true), "Developer Tools", {
      ctrl: true,
      shift: true,
    }),
    createShortcut("s", () => ui.setShowCodeSnippets(true), "Code Snippets", {
      ctrl: true,
      shift: true,
    }),
    // CodeAnalysis shortcut kaldırıldı
    createShortcut("t", () => ui.setShowAdvancedTheming(true), "Advanced Theming", {
      ctrl: true,
      shift: true,
    }),
    createShortcut("r", () => ui.setShowRemoteDevelopment(true), "Remote Development", {
      ctrl: true,
      shift: true,
    }),
    createShortcut("i", () => ui.setShowEnhancedAI(true), "Enhanced AI Tools", {
      ctrl: true,
      shift: true,
    }),
    createShortcut("v", () => ui.setShowCodeReview(true), "AI Code Review", {
      ctrl: true,
      shift: true,
    }),
    createShortcut("o", () => ui.setShowSymbolSearch(true), "Sembol Ara", {
      ctrl: true,
      shift: true,
    }),
    createShortcut("U", () => ui.setShowCodeUniverse(true), "Code Universe", {
      ctrl: true,
      shift: true,
    }),
    createShortcut(
      "F5",
      () => {
        if (!showBottomPanel) toggleBottomPanel();
      },
      "Debug Panel",
      {}
    ),
    createShortcut("z", toggleZenMode, "Zen Modu", { ctrl: true, alt: true }),
  ];
  useKeyboardShortcuts(shortcuts, project.hasProject);

  // ESC key to close panels
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showLeftSidebar) setLeftSidebarVisible(false);
        if (showRightSidebar) toggleRightSidebar();
        if (showBottomPanel) toggleBottomPanel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showLeftSidebar,
    showRightSidebar,
    showBottomPanel,
    setLeftSidebarVisible,
    toggleRightSidebar,
    toggleBottomPanel,
  ]);

  // ── Command Palette commands ─────────────────────────────────────────────
  const commands = [
    {
      id: "save-file",
      title: "Dosya Kaydet",
      description: "Aktif dosyayı kaydet",
      category: "Dosya",
      icon: "💾",
      shortcut: "Ctrl+S",
      action: editor.saveFile,
    },
    {
      id: "open-project",
      title: "Proje Aç",
      description: "Yeni proje klasörü aç",
      category: "Dosya",
      icon: "📁",
      shortcut: "Ctrl+O",
      action: project.handleOpenProject,
    },
    {
      id: "quick-open",
      title: "Hızlı Dosya Aç",
      description: "Dosya adı ile hızlı arama",
      category: "Gezinme",
      icon: "🔍",
      shortcut: "Ctrl+P",
      action: () => ui.setShowQuickFileOpen(true),
    },
    {
      id: "find-in-files",
      title: "Dosyalarda Ara",
      description: "Tüm projede metin ara",
      category: "Arama",
      icon: "🔎",
      shortcut: "Ctrl+Shift+F",
      action: () => ui.setShowFindInFiles(true),
    },
    {
      id: "toggle-terminal",
      title: "Terminal Aç/Kapat",
      description: "Terminal panelini göster/gizle",
      category: "Görünüm",
      icon: "💻",
      shortcut: "Ctrl+`",
      action: () => ui.setShowTerminal(p => !p),
    },
    {
      id: "toggle-browser",
      title: "Browser Panel Aç/Kapat",
      description: "Web test browser'ını göster/gizle",
      category: "Görünüm",
      icon: "🌐",
      shortcut: "Ctrl+Shift+B",
      action: () => ui.setShowBrowserPanel(p => !p),
    },
    {
      id: "toggle-sidebar",
      title: "Activity Bar Aç/Kapat",
      description: "Sol activity bar'ı göster/gizle",
      category: "Görünüm",
      icon: "📂",
      shortcut: "Ctrl+B",
      action: () => ui.setShowActivitySidebar(p => !p),
    },
    {
      id: "toggle-chat",
      title: "AI Sohbet Aç/Kapat",
      description: "Sağ AI sohbet panelini göster/gizle",
      category: "Görünüm",
      icon: "🤖",
      shortcut: "Ctrl+Shift+A",
      action: toggleRightSidebar,
    },
    {
      id: "toggle-bottom-panel",
      title: "Alt Panel Aç/Kapat",
      description: "Problems, Terminal, Debug panelini göster/gizle",
      category: "Görünüm",
      icon: "📊",
      shortcut: "Ctrl+J",
      action: toggleBottomPanel,
    },
    {
      id: "layout-presets",
      title: "Düzen Presetleri",
      description: "Hazır düzen şablonları",
      category: "Görünüm",
      icon: "🎨",
      shortcut: "Ctrl+Shift+L",
      action: () => ui.setShowLayoutPresets(true),
    },
    {
      id: "toggle-zen-mode",
      title: "Zen Modu Aç/Kapat",
      description: "Tüm panelleri gizle ve koda odaklan",
      category: "Görünüm",
      icon: "🧘",
      shortcut: "Ctrl+Alt+Z",
      action: toggleZenMode,
    },
    {
      id: "split-view",
      title: "Bölünmüş Görünüm",
      description: "İki dosyayı yan yana aç",
      category: "Görünüm",
      icon: "📊",
      shortcut: "Ctrl+\\",
      action: () => {
        if (editor.selectedFile && editor.fileContent)
          ui.openSplitView(editor.selectedFile, editor.fileContent);
        else addNotification(notificationHelpers.warning("Uyarı", "Önce bir dosya açın!"));
      },
    },
    {
      id: "advanced-search",
      title: "Gelişmiş Arama",
      description: "Regex ve filtrelerle arama",
      category: "Arama",
      icon: "🔍",
      shortcut: "Ctrl+Shift+H",
      action: () => ui.setShowAdvancedSearch(true),
    },
    {
      id: "git-panel",
      title: "Git Panel",
      description: "Git status ve commit araçları",
      category: "Git",
      icon: "📊",
      shortcut: "Ctrl+Shift+G",
      action: () => ui.setShowGitPanel(true),
    },
    {
      id: "settings",
      title: "Ayarlar",
      description: "Uygulama ayarları",
      category: "Ayarlar",
      icon: "⚙️",
      shortcut: "Ctrl+,",
      action: () => ui.setShowSettingsPanel(true),
    },
    {
      id: "customize-layout",
      title: "Düzeni Özelleştir",
      description: "Arayüz düzenini özelleştir",
      category: "Görünüm",
      icon: "🎨",
      shortcut: "Ctrl+Shift+K",
      action: () => ui.setShowCustomizeLayout(true),
    },
    {
      id: "developer-tools",
      title: "Developer Tools",
      description: "JSON formatter, Base64, Color picker, Regex tester",
      category: "Araçlar",
      icon: "🔧",
      shortcut: "Ctrl+Shift+D",
      action: () => ui.setShowDeveloperTools(true),
    },
    {
      id: "code-snippets",
      title: "Code Snippets & Templates",
      description: "Kod parçacıkları ve proje şablonları",
      category: "Araçlar",
      icon: "📝",
      shortcut: "Ctrl+Shift+S",
      action: () => ui.setShowCodeSnippets(true),
    },
    {
      id: "advanced-theming",
      title: "Advanced Theming",
      description: "Gelişmiş tema editörü ve özelleştirme",
      category: "Görünüm",
      icon: "🎨",
      shortcut: "Ctrl+Shift+T",
      action: () => ui.setShowAdvancedTheming(true),
    },
    {
      id: "remote-development",
      title: "Remote Development",
      description: "SSH, FTP, SFTP ve Docker bağlantıları",
      category: "Araçlar",
      icon: "🌐",
      shortcut: "Ctrl+Shift+R",
      action: () => ui.setShowRemoteDevelopment(true),
    },
    {
      id: "enhanced-ai",
      title: "Enhanced AI Tools",
      description: "Gelişmiş AI araçları: Code Review, Docs, Tests, Security",
      category: "AI",
      icon: "🤖",
      shortcut: "Ctrl+Shift+I",
      action: () => ui.setShowEnhancedAI(true),
    },
    {
      id: "code-review",
      title: "AI Code Review",
      description: "Otomatik kod inceleme ve kalite analizi",
      category: "AI",
      icon: "🔍",
      shortcut: "Ctrl+Shift+V",
      action: () => ui.setShowCodeReview(true),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  if (initError) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8 text-center text-white">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-2xl font-bold text-red-500 mb-2">Başlatma Hatası</h1>
        <p className="text-neutral-400 max-w-md mb-8">{initError}</p>
        <button
          onClick={() => {
            localStorage.clear();
            window.location.reload();
          }}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Verileri Sıfırla ve Yeniden Başlat
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex items-center justify-center">
        <LoadingSpinner size="lg" text="Uygulama yükleniyor..." />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!project.hasProject) {
    return (
      <ProjectDashboard
        onOpenProject={project.handleOpenProject}
        onCreateProject={project.handleCreateNewProject}
      />
    );
  }

  return (
    <div className="h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col relative">
      {/* Terminal Panel - Overlay */}
      {ui.showTerminal && (
        <Suspense fallback={<LoadingSpinner size="md" text="Terminal yükleniyor..." />}>
          <TerminalPanel
            projectPath={project.projectPath}
            isVisible={ui.showTerminal}
            onClose={() => ui.setShowTerminal(false)}
          />
        </Suspense>
      )}

      {/* Browser Panel - Overlay */}
      {ui.showBrowserPanel && (
        <Suspense fallback={<LoadingSpinner size="md" text="Browser yükleniyor..." />}>
          <BrowserPanel
            isVisible={ui.showBrowserPanel}
            onClose={() => ui.setShowBrowserPanel(false)}
            initialUrl="http://localhost:3000"
          />
        </Suspense>
      )}

      {!ui.showTerminal && (
        <>
          {/* UNIFIED HEADER BAR */}
          <div
            className="h-12 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-background)] flex-shrink-0 select-none z-40 px-4"
            style={{ WebkitAppRegion: "drag", appRegion: "drag" } as React.CSSProperties}
          >
            {/* Left: Logo & Menu */}
            <div
              className="flex items-center gap-6"
              style={{ WebkitAppRegion: "no-drag", appRegion: "no-drag" } as React.CSSProperties}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center font-black text-white text-[10px]">
                  C
                </div>
                <span className="font-black text-xs tracking-widest text-white/90">COREX</span>
              </div>

              <div className="flex items-center gap-1">
                {/* File menu */}
                <div className="relative group">
                  <button className="hover:bg-white/5 px-2 py-1 rounded transition-colors cursor-pointer text-[11px] text-neutral-400 hover:text-white uppercase tracking-tighter">
                    {t("menu.file")}
                  </button>
                  <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-1 backdrop-blur-2xl">
                    <button
                      onClick={project.handleOpenProject}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-blue-500 rounded-lg text-[11px] group transition-colors"
                    >
                      📂 {t("file.openProject")}
                    </button>
                    <button
                      onClick={editor.handleOpenFile}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-blue-500 rounded-lg text-[11px] transition-colors"
                    >
                      📄 {t("file.openFile")}
                    </button>
                    <div className="border-t border-white/5 my-1" />
                    <button
                      onClick={() => {
                        project.setHasProject(false);
                      }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-red-500 rounded-lg text-[11px] transition-colors"
                    >
                      🚪 {t("file.exit")}
                    </button>
                  </div>
                </div>
                {/* View menu */}
                <div className="relative group">
                  <button className="hover:bg-white/5 px-2 py-1 rounded transition-colors cursor-pointer text-[11px] text-neutral-400 hover:text-white uppercase tracking-tighter">
                    {t("menu.view")}
                  </button>
                  <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-1 backdrop-blur-2xl">
                    <button
                      onClick={() => {
                        ui.setActiveView("explorer");
                        ui.setShowActivitySidebar(true);
                      }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg text-[11px] transition-colors font-medium"
                    >
                      📂 Explorer
                    </button>
                    <button
                      onClick={() => {
                        ui.setActiveView("search");
                        ui.setShowActivitySidebar(true);
                      }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg text-[11px] transition-colors font-medium"
                    >
                      🔍 Search
                    </button>
                    <button
                      onClick={toggleRightSidebar}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg text-[11px] transition-colors font-medium"
                    >
                      🤖 AI Chat
                    </button>
                    <button
                      onClick={toggleBottomPanel}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg text-[11px] transition-colors font-medium"
                    >
                      📊 Bottom Panel
                    </button>
                    <div className="border-t border-white/5 my-1" />
                    <button
                      onClick={() => ui.setShowTerminal(!ui.showTerminal)}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg text-[11px] transition-colors font-medium"
                    >
                      ⌨️ Terminal (Ctrl+`)
                    </button>
                  </div>
                </div>

                <div className="w-[1px] h-3 bg-white/10 mx-2" />

                {/* Direct Navigation Links */}
                <div className="flex items-center gap-1">
                  {[
                    { id: "explorer", name: t("activity.explorer") },
                    { id: "search", name: t("activity.search") },
                    { id: "source-control", name: t("activity.sourceControl") },
                  ].map(nav => (
                    <button
                      key={nav.id}
                      onClick={() => {
                        ui.setActiveView(nav.id);
                        setLeftSidebarVisible(true);
                      }}
                      className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider transition-all ${ui.activeView === nav.id && showLeftSidebar
                        ? "bg-blue-500/20 text-blue-400 font-bold"
                        : "text-neutral-500 hover:text-white hover:bg-white/5"
                        }`}
                    >
                      {nav.name}
                    </button>
                  ))}

                  <div className="w-[1px] h-3 bg-white/10 mx-1" />

                  {/* Secondary Views Dropdown */}
                  <div className="relative group">
                    <button className="px-2 py-1 rounded text-[10px] uppercase tracking-wider text-neutral-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1">
                      {t("menu.view")} ▾
                    </button>
                    <div className="absolute top-full left-0 mt-1 w-44 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-1 backdrop-blur-2xl">
                      {[
                        { id: "run-debug", name: t("activity.runDebug"), icon: "🐞" },
                        { id: "api-testing", name: t("activity.apiTesting"), icon: "📡" },
                        { id: "tech-debt", name: "Tech Debt", icon: "🛠️" },
                        { id: "security-fortress", name: "Security", icon: "🛡️" },
                        { id: "model-roulette", name: "Roulette", icon: "🎰" },
                        { id: "marketplace", name: "Marketplace", icon: "🛒" },
                        { id: "academy", name: "Academy", icon: "🎓" },
                      ].map(nav => (
                        <button
                          key={nav.id}
                          onClick={() => {
                            ui.setActiveView(nav.id);
                            setLeftSidebarVisible(true);
                          }}
                          className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-[11px] transition-colors ${ui.activeView === nav.id && showLeftSidebar
                            ? "bg-blue-500/20 text-blue-400 font-bold"
                            : "hover:bg-white/5 text-neutral-400 hover:text-white"
                            }`}
                        >
                          <span className="text-sm">{nav.icon}</span>
                          {nav.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Center: Search & Project Info */}
            <div
              className="flex-1 flex justify-center px-4"
              style={{ WebkitAppRegion: "drag", appRegion: "drag" } as React.CSSProperties}
            >
              <div
                className="flex items-center gap-4 bg-white/5 border border-white/5 rounded-full px-4 py-1 hover:bg-white/10 transition-all cursor-pointer group"
                style={{ WebkitAppRegion: "no-drag", appRegion: "no-drag" } as React.CSSProperties}
                onClick={() => {
                  ui.setShowQuickFileOpen(true);
                  setLeftSidebarVisible(true);
                }}
              >
                <span className="text-neutral-500 text-xs group-hover:text-blue-400 transition-colors">
                  🔍
                </span>
                {project.projectPath ? (
                  <span className="text-[11px] font-bold text-white/50 group-hover:text-white transition-colors">
                    {project.projectPath.split(/[\\\/]/).pop()} — {fileIndex.length} files
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-white/50 group-hover:text-white transition-colors">
                    Search Project... (Ctrl+P)
                  </span>
                )}
                <div className="flex gap-1">
                  <span className="px-1 py-0.5 bg-white/5 border border-white/5 rounded text-[8px] text-neutral-500">
                    Ctrl
                  </span>
                  <span className="px-1 py-0.5 bg-white/5 border border-white/5 rounded text-[8px] text-neutral-500">
                    P
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Controls */}
            <div
              className="flex items-center gap-1"
              style={{ WebkitAppRegion: "no-drag", appRegion: "no-drag" } as React.CSSProperties}
            >
              <button
                onClick={toggleRightSidebar}
                className="p-2 hover:bg-white/5 text-neutral-400 hover:text-white rounded-lg transition-colors"
                title="AI Sohbet (Ctrl+Shift+A)"
              >
                💬
              </button>
              <StatusIndicator />
              <button
                onClick={() => ui.setShowAISettings(true)}
                className="p-2 hover:bg-white/5 text-neutral-400 hover:text-white rounded-lg transition-colors"
                title="AI Settings"
              >
                ⚙️
              </button>
              <button
                onClick={() => ui.setShowCodeUniverse(true)}
                className="p-2 hover:bg-white/5 text-neutral-400 hover:text-white rounded-lg transition-colors"
                title="Project Graph (3D)"
              >
                🌌
              </button>

              <div className="w-[1px] h-4 bg-white/10 mx-2" />

              <div className="flex items-center">
                <button
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/5 text-neutral-400 hover:text-white rounded-lg transition-colors"
                  onClick={ui.handleMinimize}
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z" />
                  </svg>
                </button>
                <button
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/5 text-neutral-400 hover:text-white rounded-lg transition-colors"
                  onClick={ui.handleMaximize}
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2.5 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2h-11zM1 2a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2z" />
                  </svg>
                </button>
                <button
                  className="w-8 h-8 flex items-center justify-center hover:bg-red-500/20 text-neutral-400 hover:text-red-500 rounded-lg transition-colors"
                  onClick={ui.handleClose}
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Side Panel */}
            <Suspense
              fallback={
                <div className="w-64 bg-[var(--color-background)] border-r border-[var(--color-border)] flex items-center justify-center">
                  <LoadingSpinner size="sm" />
                </div>
              }
            >
              <SidePanel
                activeView={ui.activeView}
                isVisible={showLeftSidebar}
                width={leftSidebarWidth}
                onWidthChange={setLeftSidebarWidth}
                projectPath={project.projectPath}
                files={project.files}
                selectedFile={editor.selectedFile}
                onFileSelect={editor.openFile}
                onFileCreate={filePath => {
                  addNotification(notificationHelpers.success("Dosya Oluşturuldu", filePath));
                  project.loadOrIndexProject(project.projectPath);
                }}
                onFileDelete={filePath => {
                  addNotification(notificationHelpers.success("Dosya Silindi", filePath));
                  project.loadOrIndexProject(project.projectPath);
                }}
                onFileRename={(oldPath, newPath) => {
                  addNotification(
                    notificationHelpers.success(
                      "Dosya Yeniden Adlandırıldı",
                      `${oldPath} → ${newPath}`
                    )
                  );
                  project.loadOrIndexProject(project.projectPath);
                }}
                onRefresh={() => {
                  project.loadOrIndexProject(project.projectPath);
                  addNotification(
                    notificationHelpers.success("Yenilendi", "Proje dosyaları güncellendi")
                  );
                }}
                onWorkspaceSelect={project.handleProjectSelect}
                onNewProject={project.handleOpenProject}
                onOpenWorkspace={project.handleOpenProject}
                onSettingsClick={() => ui.setShowSettingsPanel(true)}
                fileIndex={fileIndex}
              />
            </Suspense>

            {/* Center - Code Editor */}
            <div
              className={`flex-1 flex flex-col bg-[var(--color-background)] min-w-0 h-full ${isZenMode ? "" : "pb-14"}`}
            >
              <div className={`flex-1 min-h-0 ${showBottomPanel ? "" : "h-full"}`}>
                {ui.activeView === "compare" ? (
                  <Suspense
                    fallback={
                      <LoadingSpinner size="lg" text="Karşılaştırma yükleniyor..." fullScreen />
                    }
                  >
                    <ModelComparison onClose={() => ui.setActiveView("explorer")} />
                  </Suspense>
                ) : ui.showSplitView && ui.splitFiles ? (
                  <Suspense
                    fallback={
                      <LoadingSpinner size="lg" text="Split View yükleniyor..." fullScreen />
                    }
                  >
                    <SplitView
                      leftFile={ui.splitFiles.left}
                      rightFile={ui.splitFiles.right}
                      onLeftChange={content =>
                        ui.setSplitFiles(prev =>
                          prev ? { ...prev, left: { ...prev.left, content } } : null
                        )
                      }
                      onRightChange={content =>
                        ui.setSplitFiles(prev =>
                          prev ? { ...prev, right: { ...prev.right, content } } : null
                        )
                      }
                      onSave={side => alert(`${side} dosya kaydedildi!`)}
                      onClose={ui.closeSplitView}
                    />
                  </Suspense>
                ) : editor.selectedFile ? (
                  <Suspense
                    fallback={<LoadingSpinner size="lg" text="Editor yükleniyor..." fullScreen />}
                  >
                    <EnhancedEditor
                      filePath={editor.selectedFile}
                      content={editor.fileContent}
                      onChange={editor.handleEditorChange}
                      onSave={editor.saveFile}
                      onCursorPositionChange={(line, column) =>
                        editor.setCursorPosition({ line, column })
                      }
                      onSelectionChange={(selection) =>
                        editor.setSelection(selection)
                      }
                    />
                  </Suspense>
                ) : (
                  <Suspense fallback={<LoadingSpinner size="lg" text="Dashboard yükleniyor..." fullScreen />}>
                    <Dashboard />
                  </Suspense>
                )}
              </div>

              <Suspense fallback={null}>
                <BottomPanel
                  isVisible={showBottomPanel}
                  onToggle={toggleBottomPanel}
                  pendingActions={chat.pendingActions}
                  onAcceptAction={async (actionId) => {
                    const action = chat.pendingActions.find((a) => a.id === actionId);
                    if (!action) return;
                    try {
                      let actualFilePath = action.filePath;
                      if (!action.filePath.includes("\\") && !action.filePath.includes("/")) {
                        actualFilePath = `${project.projectPath}\\${action.filePath}`;
                      }
                      const fileInIndex = fileIndex.find((f) => {
                        const fn = f.path.split(/[\\\/]/).pop();
                        const afn = action.filePath.split(/[\\\/]/).pop();
                        return fn === afn || f.path.includes(action.filePath) || f.path.endsWith(action.filePath);
                      });
                      if (fileInIndex) actualFilePath = fileInIndex.path;
                      try { await invoke("write_file", { path: actualFilePath, content: action.content }); }
                      catch { await invoke("create_file", { path: actualFilePath, content: action.content }); }
                      chat.setPendingActions((prev) => prev.filter((a) => a.id !== actionId));
                      await editor.openFile(actualFilePath);
                      chat.addMessage({ role: "system", content: `✅ Değişiklikler uygulandı: ${actualFilePath.split(/[\\\/]/).pop()}`, timestamp: Date.now() });
                      setTimeout(() => project.addFileToIndex(actualFilePath, action.content), 1000);
                    } catch (err) {
                      chat.addMessage({ role: "system", content: `❌ Değişiklikler uygulanamadı: ${err}`, timestamp: Date.now() });
                      chat.setPendingActions((prev) => prev.filter((a) => a.id !== actionId));
                    }
                  }}
                  onRejectAction={actionId => {
                    chat.setPendingActions(prev => prev.filter(a => a.id !== actionId));
                    chat.addMessage({
                      role: "system",
                      content: "❌ Değişiklikler reddedildi",
                      timestamp: Date.now(),
                    });
                  }}
                  onAcceptAllActions={async () => {
                    if (chat.pendingActions.length === 0) return;
                    const filesToOpen: string[] = [];
                    for (const action of chat.pendingActions) {
                      try {
                        let actualFilePath = action.filePath;
                        const fileInIndex = fileIndex.find(f => {
                          const fn = f.path.split(/[\\\/]/).pop();
                          const afn = action.filePath.split(/[\\\/]/).pop();
                          return fn === afn || f.path.includes(action.filePath);
                        });
                        if (fileInIndex) actualFilePath = fileInIndex.path;
                        try {
                          await invoke("write_file", {
                            path: actualFilePath,
                            content: action.content,
                          });
                        } catch {
                          await invoke("create_file", {
                            path: actualFilePath,
                            content: action.content,
                          });
                        }
                        filesToOpen.push(actualFilePath);
                        setTimeout(
                          () => project.addFileToIndex(actualFilePath, action.content),
                          2000
                        );
                      } catch (err) {
                        console.error(`Dosya yazma hatası (${action.filePath}):`, err);
                      }
                    }
                    if (filesToOpen.length > 0) await editor.openFile(filesToOpen[0]);
                    chat.setPendingActions([]);
                    chat.addMessage({
                      role: "system",
                      content: `✅ ${filesToOpen.length} dosya güncellendi!`,
                      timestamp: Date.now(),
                    });
                  }}
                  fileIndex={fileIndex}
                  projectPath={project.projectPath}
                  currentFile={editor.selectedFile}
                  onSuggestionClick={action => chat.sendMessage(action)}
                  onBreakpointToggle={(filePath, lineNumber) =>
                    addNotification(
                      notificationHelpers.info("Breakpoint", `${filePath}:${lineNumber}`)
                    )
                  }
                />
              </Suspense>

              <div className="h-5 bg-[var(--color-background)] border-t border-[var(--color-border)] flex items-center justify-between px-3 flex-shrink-0">
                {/* AI Problems Panel Trigger */}
                <div style={{ height: "100%", display: "flex", alignItems: "center" }}>
                  <AIProblemsPanel
                    isOpen={aiAnalysis.isPanelOpen}
                    onToggle={() => aiAnalysis.setIsPanelOpen(p => !p)}
                    currentFileResult={aiAnalysis.currentFileResult}
                    allResults={aiAnalysis.allResults}
                    isAnalyzing={aiAnalysis.isAnalyzing}
                    currentlyAnalyzing={aiAnalysis.currentlyAnalyzing}
                    selectedFile={editor.selectedFile}
                    onFileClick={editor.openFile}
                  />
                </div>
                <span
                  className="text-xs font-medium"
                  style={{
                    color: "var(--color-textSecondary)",
                    background: "var(--color-surface)",
                    padding: "2px 6px",
                    borderRadius: "3px",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  Corex v0.1.0
                </span>
              </div>
            </div>

            {/* Right Sidebar - AI Chat */}
            {showRightSidebar && (
              <div
                className="h-full border-l border-[var(--color-border)] bg-[var(--color-background)] flex-shrink-0 overflow-hidden flex"
                style={{ width: `${rightSidebarWidth}px` }}
              >
                <div
                  className="w-1 bg-neutral-700 hover:bg-blue-500 cursor-ew-resize transition-colors flex-shrink-0"
                  onMouseDown={e => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startWidth = rightSidebarWidth;
                    const onMove = (ev: MouseEvent) =>
                      setRightSidebarWidth(
                        Math.max(200, Math.min(600, startWidth - (ev.clientX - startX)))
                      );
                    const onUp = () => {
                      document.removeEventListener("mousemove", onMove);
                      document.removeEventListener("mouseup", onUp);
                    };
                    document.addEventListener("mousemove", onMove);
                    document.addEventListener("mouseup", onUp);
                  }}
                />
                <div className="flex-1 h-full flex flex-col overflow-hidden">
                  <ChatPanel
                    messages={chat.messages}
                    isLoading={chat.isLoading}
                    isStreaming={chat.isLoading}
                    onSendMessage={chat.sendMessage}
                    pendingActions={chat.pendingActions}
                    onAcceptAction={async actionId => {
                      const action = chat.pendingActions.find(a => a.id === actionId);
                      if (!action) return;
                      try {
                        let actualFilePath = action.filePath;
                        if (!action.filePath.includes("\\") && !action.filePath.includes("/"))
                          actualFilePath = `${project.projectPath}/${action.filePath}`;
                        const fileInIndex = fileIndex.find(f => {
                          const fn = f.path.split(/[\\\/]/).pop();
                          const afn = action.filePath.split(/[\\\/]/).pop();
                          return fn === afn || f.path.includes(action.filePath);
                        });
                        if (fileInIndex) actualFilePath = fileInIndex.path;

                        // FIX-32: Recovery mechanism (Safety first)
                        let backupContent: string | null = null;
                        try {
                          backupContent = await invoke("read_file", { path: actualFilePath });
                        } catch { /* New file */ }

                        try {
                          await invoke("write_file", {
                            path: actualFilePath,
                            content: action.content,
                          });
                        } catch (err) {
                          // Try restore if failed
                          if (backupContent) {
                            await invoke("write_file", { path: actualFilePath, content: backupContent });
                          }
                          await invoke("create_file", {
                            path: actualFilePath,
                            content: action.content,
                          });
                        }
                        chat.setPendingActions(prev => prev.filter(a => a.id !== actionId));
                        await editor.openFile(actualFilePath);
                        chat.addMessage({
                          role: "system",
                          content: `✅ Değişiklikler uygulandı: ${actualFilePath.split(/[\\\/]/).pop()}`,
                          timestamp: Date.now(),
                        });
                        setTimeout(
                          () => project.addFileToIndex(actualFilePath, action.content),
                          1000
                        );
                      } catch (err) {
                        chat.addMessage({
                          role: "system",
                          content: `❌ Değişiklikler uygulanamadı: ${err}`,
                          timestamp: Date.now(),
                        });
                        chat.setPendingActions(prev => prev.filter(a => a.id !== actionId));
                      }
                    }}
                    onRejectAction={actionId => {
                      chat.setPendingActions(prev => prev.filter(a => a.id !== actionId));
                      chat.addMessage({
                        role: "system",
                        content: "❌ Değişiklikler reddedildi",
                        timestamp: Date.now(),
                      });
                    }}
                    onAcceptAllActions={async () => {
                      if (chat.pendingActions.length === 0) return;
                      const filesToOpen: string[] = [];
                      for (const action of chat.pendingActions) {
                        try {
                          let actualFilePath = action.filePath;
                          const fileInIndex = fileIndex.find(f => {
                            const fn = f.path.split(/[\\\/]/).pop();
                            const afn = action.filePath.split(/[\\\/]/).pop();
                            return fn === afn || f.path.includes(action.filePath);
                          });
                          if (fileInIndex) actualFilePath = fileInIndex.path;
                          try {
                            await invoke("write_file", {
                              path: actualFilePath,
                              content: action.content,
                            });
                          } catch {
                            await invoke("create_file", {
                              path: actualFilePath,
                              content: action.content,
                            });
                          }
                          filesToOpen.push(actualFilePath);
                          setTimeout(
                            () => project.addFileToIndex(actualFilePath, action.content),
                            2000
                          );
                        } catch (err) {
                          console.error(`Dosya yazma hatası (${action.filePath}):`, err);
                        }
                      }
                      if (filesToOpen.length > 0) await editor.openFile(filesToOpen[0]);
                      chat.setPendingActions([]);
                      chat.addMessage({
                        role: "system",
                        content: `✅ ${filesToOpen.length} dosya güncellendi!`,
                        timestamp: Date.now(),
                      });
                    }}
                    onNewSession={chat.handleNewSession}
                    isIndexing={project.isIndexing}
                    currentFile={editor.selectedFile}
                    projectContext={chat.getProjectContext()}
                    onStopGeneration={chat.handleStopGeneration}
                    onRegenerateResponse={chat.handleRegenerateResponse}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )
      }

      {/* Notification Toast */}
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      {/* Modals & Overlays */}
      <Suspense fallback={null}>
        <CommandPalette
          isOpen={ui.showCommandPalette}
          onClose={() => ui.setShowCommandPalette(false)}
          commands={commands}
        />
      </Suspense>
      <Suspense fallback={null}>
        <QuickFileOpen
          isOpen={ui.showQuickFileOpen}
          onClose={() => ui.setShowQuickFileOpen(false)}
          files={project.files}
          onFileSelect={editor.openFile}
        />
      </Suspense>
      <Suspense fallback={null}>
        <FindInFiles
          isOpen={ui.showFindInFiles}
          onClose={() => ui.setShowFindInFiles(false)}
          fileIndex={fileIndex}
          onFileSelect={editor.openFile}
        />
      </Suspense>
      <Suspense fallback={null}>
        <LayoutPresets
          isOpen={ui.showLayoutPresets}
          onClose={() => ui.setShowLayoutPresets(false)}
        />
      </Suspense>
      <Suspense fallback={null}>
        <AdvancedSearch
          isOpen={ui.showAdvancedSearch}
          onClose={() => ui.setShowAdvancedSearch(false)}
          fileIndex={fileIndex}
          onFileSelect={editor.openFile}
        />
      </Suspense>
      <Suspense fallback={null}>
        <SettingsPanel
          isOpen={ui.showSettingsPanel}
          onClose={() => ui.setShowSettingsPanel(false)}
          onShowLayoutPresets={() => ui.setShowLayoutPresets(true)}
        />
      </Suspense>
      <Suspense fallback={null}>
        <CustomizeLayout
          isOpen={ui.showCustomizeLayout}
          onClose={() => ui.setShowCustomizeLayout(false)}
        />
      </Suspense>
      <Suspense fallback={null}>
        <DeveloperTools
          isOpen={ui.showDeveloperTools}
          onClose={() => ui.setShowDeveloperTools(false)}
        />
      </Suspense>
      <Suspense fallback={null}>
        <CodeSnippets
          isOpen={ui.showCodeSnippets}
          onClose={() => ui.setShowCodeSnippets(false)}
          onInsertSnippet={code => {
            if (editor.selectedFile) {
              editor.handleEditorChange(editor.fileContent + "\n" + code);
              addNotification(
                notificationHelpers.success("Snippet Eklendi", "Kod parçacığı editöre eklendi")
              );
            } else addNotification(notificationHelpers.warning("Uyarı", "Önce bir dosya açın!"));
          }}
          onCreateProject={template =>
            addNotification(
              notificationHelpers.info(
                "Proje Şablonu",
                `${template.name} şablonu seçildi. Bu özellik yakında eklenecek!`
              )
            )
          }
        />
      </Suspense>
      {/* CodeAnalysis modal kaldırıldı — analiz artık status bar + chat içinde */}
      <Suspense fallback={null}>
        <AdvancedTheming
          isOpen={ui.showAdvancedTheming}
          onClose={() => ui.setShowAdvancedTheming(false)}
        />
      </Suspense>
      <Suspense fallback={null}>
        <RemoteDevelopment
          isOpen={ui.showRemoteDevelopment}
          onClose={() => ui.setShowRemoteDevelopment(false)}
          onOpenRemoteFile={(connection, filePath) =>
            addNotification(
              notificationHelpers.info("Remote File", `Opening ${filePath} from ${connection.name}`)
            )
          }
        />
      </Suspense>
      <Suspense fallback={null}>
        <AISettings
          isVisible={ui.showAISettings}
          onClose={() => ui.setShowAISettings(false)}
          onProviderChange={providers => console.log("AI providers updated:", providers)}
        />
      </Suspense>

      {
        ui.showSymbolSearch && (
          <SymbolSearchUI
            onSelect={result => {
              editor.openFile(result.filePath);
              ui.setShowSymbolSearch(false);
            }}
            onClose={() => ui.setShowSymbolSearch(false)}
          />
        )
      }

      {
        ui.showCodeUniverse && (
          <Suspense fallback={<LoadingSpinner size="lg" text="Universe Expanding..." />}>
            <CodeUniversePanel
              projectPath={project.projectPath}
              onOpenFile={editor.openFile}
              onClose={() => ui.setShowCodeUniverse(false)}
            />
          </Suspense>
        )
      }

      {
        ui.showGitPanel && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => ui.setShowGitPanel(false)}
            />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <div
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <Suspense fallback={<LoadingSpinner size="lg" text="Git Panel yükleniyor..." />}>
                  <GitPanel
                    projectPath={project.projectPath}
                    onFileSelect={editor.openFile}
                    onClose={() => ui.setShowGitPanel(false)}
                  />
                </Suspense>
              </div>
            </div>
          </>
        )
      }

      {
        ui.showEnhancedAI && (
          <Suspense fallback={<LoadingSpinner size="lg" text="AI Panel yükleniyor..." />}>
            <EnhancedAIPanel
              selectedFile={editor.selectedFile}
              fileContent={editor.fileContent}
              onClose={() => ui.setShowEnhancedAI(false)}
            />
          </Suspense>
        )
      }

      {
        ui.showCodeReview && (
          <Suspense fallback={<LoadingSpinner size="lg" text="Code Review yükleniyor..." />}>
            <CodeReviewPanel
              filePath={editor.selectedFile}
              content={editor.fileContent}
              isVisible={ui.showCodeReview}
              onClose={() => ui.setShowCodeReview(false)}
            />
          </Suspense>
        )
      }

      {/* Tool Approval Dialog */}
      {
        chat.toolApprovalRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
            <div className="bg-[#1e1e1e] border border-neutral-700 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-yellow-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">Tool Onayı Gerekiyor</h3>
                  <p className="text-sm text-neutral-400">AI bir tool çalıştırmak istiyor</p>
                </div>
              </div>
              <div className="bg-[#252525] rounded-lg p-4 mb-4 border border-neutral-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-purple-400">
                    🔧 {chat.toolApprovalRequest.toolName}
                  </span>
                </div>
                <div className="text-xs text-neutral-300">
                  <div className="font-semibold mb-1">Parametreler:</div>
                  <pre className="bg-black/30 p-2 rounded overflow-x-auto text-[10px]">
                    {JSON.stringify(chat.toolApprovalRequest.parameters, null, 2)}
                  </pre>
                </div>
                {chat.toolApprovalRequest.toolName === "run_terminal" && (
                  <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                    ⚠️ Terminal komutu çalıştırılacak. Dikkatli olun!
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    chat.toolApprovalRequest!.resolve(false);
                    chat.setToolApprovalRequest(null);
                  }}
                  className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  ❌ Reddet
                </button>
                <button
                  onClick={() => {
                    chat.toolApprovalRequest!.resolve(true);
                    chat.setToolApprovalRequest(null);
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  ✅ Onayla
                </button>
              </div>
              <div className="mt-3 text-xs text-neutral-500 text-center">
                Autonomy ayarlarını değiştirmek için AI Settings&apos;e gidin
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// App — sadece provider composition
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ThemeProvider>
          <LayoutProvider>
            <NotificationProvider>
              <AppContent />
              <ToastContainer />
            </NotificationProvider>
          </LayoutProvider>
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
