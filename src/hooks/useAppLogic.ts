import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useNotifications } from "../components/NotificationSystem";
import { useLayout } from "../contexts/LayoutContext";
import { useCore } from "./useCore";
import { useProjectManager } from "./useProjectManager";
import { useFileEditor } from "./useFileEditor";
import { useChatMessages } from "./useChatMessages";
import { useUIState } from "./useUIState";
import { useAIBackgroundAnalysis } from "./useAIBackgroundAnalysis";
import { useKeyboardShortcuts, createShortcut } from "./useKeyboardShortcuts";
import { agentService } from "../services/agentService";
import { useVoiceLogic } from "./useVoiceLogic";
import { useAppFuturism } from "./useAppFuturism";
import { FileIndex } from "../types/index";
import { WorkflowNotification } from "../types/workflow";
import { initializeExtension } from "../extension";
import { cacheManager } from "../services/cache";
import { buildCommandPaletteList } from "./commands/commandPalette";

// Futurism services are now in useAppFuturism hook
// other futuristic services...

export function useAppLogic() {
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

    // Shared file index state
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

    // ── Dream Mode Integration ───────────────────────────────────────────────
    useEffect(() => {
        // Just start listening on mount
        import("../services/dreamMode").then(({ dreamModeService }) => {
            if (project.files.length > 0) {
                dreamModeService.setProjectFiles(project.files);
            }
        }).catch(err => console.error("Failed to load Dream Mode:", err));
    }, [project.files]);

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

    // 🆕 Active Model Indicator
    const [activeModelName, setActiveModelName] = useState<string | null>(null);

    useEffect(() => {
        const updateModel = () => {
            const ggufConfig = localStorage.getItem('gguf-active-model');
            if (ggufConfig) {
                try {
                    const parsed = JSON.parse(ggufConfig);
                    setActiveModelName(parsed.modelName || 'Local GGUF');
                } catch (e) {
                    setActiveModelName(null);
                }
            } else {
                setActiveModelName(null);
            }
        };

        updateModel();
        window.addEventListener('storage', updateModel);
        window.addEventListener('gguf-model-loaded', updateModel);
        return () => {
            window.removeEventListener('storage', updateModel);
            window.removeEventListener('gguf-model-loaded', updateModel);
        };
    }, []);

    // 🤖 Connect Autonomous Agent to Chat
    useEffect(() => {
        const callback = (msg: any) => {
            chat.addMessage(msg);
            // Otonom ajan mesaj gönderdiğinde chat panelini otomatik açabiliriz?
            if (!showRightSidebar) toggleRightSidebar();
        };

        agentService.registerChatCallback(callback);
        return () => agentService.registerChatCallback(() => { });
    }, [showRightSidebar, toggleRightSidebar, chat]); // Chat added to deps

    // 🎙️ Voice Command Handling
    const voice = useVoiceLogic(editor, toggleLeftSidebar, toggleRightSidebar, chat, notify);

    // ── AI Background Analysis (proaktif — dosya açıldığında otomatik) ────────
    const [isAIReady, setIsAIReady] = useState(false);

    useEffect(() => {
        const checkAI = async () => {
            const { loadAIProviders } = await import("../services/ai/aiProvider");
            const providers = await loadAIProviders();
            setIsAIReady(providers.length > 0);
        };
        checkAI();
    }, []);

    const aiAnalysis = useAIBackgroundAnalysis(editor.selectedFile, editor.fileContent, isAIReady);

    // Futurism & Autonomy logic (codeOracle removed per user request)
    useAppFuturism(editor.selectedFile, editor.fileContent, notify);

    // Workflow notification state
    const [notification, setNotification] = useState<WorkflowNotification | null>(null);

    // ── Initialization ───────────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            try {
                await initializeExtension();
                console.log("✅ Extension initialized");

                // 🆕 RAG Service Initialization (only in Tauri)
                const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
                if (isTauri) {
                    const { ragService } = await import("../services/ai");
                    const { appDataDir, join } = await import("@tauri-apps/api/path");
                    const appData = await appDataDir();
                    const vectorDbPath = await join(appData, "vector_db");
                    await ragService.init(vectorDbPath).catch(e => console.warn("RAG Init failed:", e));
                } else {
                    console.warn("⚠️ Not in Tauri — skipping RAG init & Tauri APIs");
                }
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
                const { unloadGgufModel } = await import("../services/ai");
                await unloadGgufModel();
            } catch { }
        };

        window.addEventListener("beforeunload", cleanup);
        return () => {
            window.removeEventListener("beforeunload", cleanup);
            cleanup();
        };
    }, []);

    // 🎨 Plugin-driven Theming Engine
    useEffect(() => {
        const handleRegisterTheme = (e: any) => {
            const theme = e.detail;
            if (theme && theme.colors) {
                console.log(`🎨 Applying plugin theme: ${theme.name} `);
                const root = document.documentElement;
                Object.entries(theme.colors).forEach(([key, value]) => {
                    root.style.setProperty(key as string, value as string);
                });
                notify("success", "Tema Değişti", `${theme.name} teması uygulandı.`);
            }
        };

        const handleOpenBrowser = (e: any) => {
            const { url } = e.detail || {};
            ui.setShowBrowserPanel(true);
            if (url) {
                notify("info", "Otonom Test", `Tarayıcı açılıyor: ${url}`);
            }
        };

        window.addEventListener('corex:register-theme', handleRegisterTheme);
        window.addEventListener('corex:open-browser', handleOpenBrowser);
        return () => {
            window.removeEventListener('corex:register-theme', handleRegisterTheme);
            window.removeEventListener('corex:open-browser', handleOpenBrowser);
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
    const commands = buildCommandPaletteList(
        editor,
        project,
        ui,
        toggleRightSidebar,
        toggleBottomPanel,
        toggleZenMode,
        notify
    );

    return {
        initError,
        user,
        loading,
        ui,
        t,
        notify,
        layout: {
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
        },
        fileIndex,
        setFileIndex,
        project,
        editor,
        chat,
        voice,
        aiAnalysis,
        notification,
        setNotification,
        commands,
        activeModelName, // Added activeModelName to the return object
        shortcuts
    };
}
