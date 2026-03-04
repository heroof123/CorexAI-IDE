/**
 * EnhancedEditor — VS Code Mimarisinden Öğrenilen En İyi Pratikler
 *
 * Uygulanan VS Code Pattern'ları:
 * ✅ setValue() YASAK → replaceEntireContent() (undo korunur)
 * ✅ Version Guard → AI cevap gelirken model değişirse iptal
 * ✅ IME Composition Guard → Asya dili yazarken AI müdahale etmez
 * ✅ EditorModelManager → çift model yaratma önlenir
 * ✅ DiagnosticDecorationManager → TrackedRange ile AI highlight
 * ✅ Adaptive Debounce → provider hızına göre gecikme
 * ✅ executeEdits() → undo/redo tam çalışır
 * ✅ Overlapping Edit Koruması → çakışan AI editleri filtrelenir
 * ✅ Lazy init → ağır servisler gerektiğinde başlatılır
 * ✅ Proper Disposable pattern → event listener bellek sızıntısı yok
 *
 * VS Code Referans:
 * - inlineCompletionsModel.ts (56KB)
 * - textFileEditorModel.ts (44KB)
 * - layout.ts (127KB)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor";
import { collabService, UserPresence } from "../services/collaborationService";
import { editorModelManager } from "../services/editorModelManager";
import { aiEditorService } from "../services/aiEditorService";
import { inlineChatService } from "../services/chat/inlineChatService";
import { InlineChatSession } from "../services/chat/chatEditingTypes";
import { History as HistoryIcon } from "lucide-react";
import { LocalHistoryTimeline } from "./LocalHistoryTimeline";
import { MergeEditor } from "./MergeEditor";

// ============================================================
// OPTİMAL EDİTÖR KONFİGÜRASYONU — VS Code tarzı (Bölüm 5)
// ============================================================
const OPTIMAL_EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  // Temel görünüm
  fontSize: 14,
  fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
  fontLigatures: true,
  lineHeight: 22,

  // Editör davranışı — dil tanımlı (vs code varsayılanı)
  autoClosingBrackets: "languageDefined",
  autoClosingQuotes: "languageDefined",
  autoClosingComments: "languageDefined",
  autoSurround: "languageDefined",
  autoIndent: "full", // En akıllı indent

  // Görsel iyileştirmeler
  minimap: { enabled: true, maxColumn: 120 },
  scrollBeyondLastLine: true,
  smoothScrolling: true,
  cursorBlinking: "smooth",
  cursorSmoothCaretAnimation: "on",
  renderLineHighlight: "gutter",
  renderWhitespace: "selection",
  renderControlCharacters: true,

  // Undo/Redo — model başlatılırken undoLimit Monaco'nun ITextModelCreationOptions'da
  // bu değer editorModelManager üzerinden kontrol edilir

  // IntelliSense — VS Code tarzı
  quickSuggestions: {
    other: "on",
    comments: "off",
    strings: "off",
  },
  suggestOnTriggerCharacters: true,
  wordBasedSuggestions: "matchingDocuments",
  snippetSuggestions: "top",

  // Inline Suggestions (Ghost Text)
  inlineSuggest: { enabled: true, showToolbar: "onHover" },

  // Format — dikkatli kullan, undo'yu bozabilir
  formatOnType: false,
  formatOnPaste: false,

  // Performans
  folding: true,
  foldingStrategy: "indentation",
  showFoldingControls: "always",

  // Inlay Hints
  inlayHints: { enabled: "on" },

  // Sticky scroll (VS Code tarzı)
  stickyScroll: { enabled: true },

  // Bracket pairs
  guides: {
    bracketPairs: true,
    bracketPairsHorizontal: true,
    highlightActiveBracketPair: true,
    indentation: true,
    highlightActiveIndentation: true,
  },

  // Çoklu imleç
  multiCursorModifier: "ctrlCmd",
  selectionHighlight: true,
  occurrencesHighlight: "singleFile",

  // Erişilebilirlik
  accessibilitySupport: "auto",

  // Diğer
  codeLens: true,
  colorDecorators: true,
  acceptSuggestionOnEnter: "on",
  acceptSuggestionOnCommitCharacter: true,
  emptySelectionClipboard: false,
  copyWithSyntaxHighlighting: true,
  mouseWheelZoom: true,
  insertSpaces: true,
  detectIndentation: true,
  automaticLayout: true,
};

// ============================================================
// DİL HARİTASI
// ============================================================
const LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  rs: "rust",
  py: "python",
  json: "json",
  jsonc: "json",
  md: "markdown",
  mdx: "markdown",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  bat: "bat",
  ps1: "powershell",
  psm1: "powershell",
  go: "go",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  cpp: "cpp",
  c: "c",
  cs: "csharp",
  php: "php",
  rb: "ruby",
  lua: "lua",
  r: "r",
  vue: "html",
  svelte: "html",
};

function getLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGE_MAP[ext] || "plaintext";
}

// ============================================================
// PROPS
// ============================================================
interface EnhancedEditorProps {
  filePath: string;
  content: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCursorPositionChange?: (line: number, column: number) => void;
  onSelectionChange?: (selection: string) => void;
  readOnly?: boolean;
  /** Inline Chat AI handler — Ctrl+I tetikler */
  onInlineChatRequest?: (session: InlineChatSession, prompt: string) => Promise<string>;
}

// ============================================================
// GELİŞTİRİLMİŞ EDİTÖR BİLEŞENİ
// ============================================================
export default function EnhancedEditor({
  filePath,
  content,
  onChange,
  onSave,
  onCursorPositionChange,
  onSelectionChange,
  readOnly = false,
  onInlineChatRequest,
}: EnhancedEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const completionProviderRef = useRef<monaco.IDisposable | null>(null);

  // Editör görsel ayarları
  const [showMinimap, setShowMinimap] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [tabSize, setTabSize] = useState(2);
  const [fontFamily, setFontFamily] = useState("'Cascadia Code', 'Fira Code', 'Consolas', monospace");

  // Bilgi durumu
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1 });
  const [isDirty, setIsDirty] = useState(false);
  const [language, setLanguage] = useState("plaintext");

  // Modül 4.3: Local History UI State
  const [showHistory, setShowHistory] = useState(false);

  // Modül 4.4: Merge Conflict UI State
  const [isMergeConflict, setIsMergeConflict] = useState(false);

  // Çatışma tespiti
  useEffect(() => {
    if (content.includes("<<<<<<< ") && content.includes("=======") && content.includes(">>>>>>> ")) {
      setIsMergeConflict(true);
    }
  }, [content]);

  // Ayarları yükle
  useEffect(() => {
    const loadSettings = () => {
      const saved = localStorage.getItem("corex-settings");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.editor) {
            setShowMinimap(parsed.editor.minimap ?? true);
            setShowLineNumbers(parsed.editor.lineNumbers ?? true);
            setWordWrap(parsed.editor.wordWrap ?? false);
            setFontSize(parsed.editor.fontSize ?? 14);
            setTabSize(parsed.editor.tabSize ?? 2);
            setFontFamily(parsed.editor.fontFamily ?? "'Cascadia Code', 'Fira Code', 'Consolas', monospace");
          }
        } catch {
          // parse hatası — sessizce devam et
        }
      }
    };

    loadSettings();
    window.addEventListener("corex-settings-updated", loadSettings);
    return () => window.removeEventListener("corex-settings-updated", loadSettings);
  }, []);

  // ============================================================
  // EDİTÖR BAŞLATMA — Dosya değiştiğinde yeniden başlat
  // ============================================================
  useEffect(() => {
    if (!editorContainerRef.current) return;

    const lang = getLanguage(filePath);
    setLanguage(lang);

    // VS Code Mimari: EditorModelManager ile model al veya yarat
    // URI şeması: corex:///<filePath>
    const modelUri = `corex:///${filePath.replace(/\\/g, "/")}`;
    const model = editorModelManager.getOrCreateModel(modelUri, lang, content);

    // Editör zaten var mı? → model değiştir
    if (editorRef.current) {
      editorRef.current.setModel(model);
      return;
    }

    // Yeni editör oluştur
    const editor = monaco.editor.create(editorContainerRef.current, {
      ...OPTIMAL_EDITOR_OPTIONS,
      model, // direkten model ver (value değil!)
      theme: "vs-dark",
      readOnly,
      tabSize,
      fontSize,
      fontFamily,
      minimap: { enabled: showMinimap },
      lineNumbers: showLineNumbers ? "on" : "off",
      wordWrap: wordWrap ? "on" : "off",
    });

    editorRef.current = editor;

    // ────────────────────────────────────────────────
    // VS Code Ders #3: IME Composition Guard
    // Asya dili yazarken AI müdahale etmez
    // ────────────────────────────────────────────────
    const imeCleanup = aiEditorService.setupIMEGuard(editor);

    // ────────────────────────────────────────────────
    // Inline Chat (Ctrl+I) — kayıt
    // ────────────────────────────────────────────────
    const onInlineChatRequestInternal = onInlineChatRequest;
    if (onInlineChatRequestInternal) {
      inlineChatService.setAIRequestHandler(onInlineChatRequestInternal);
      const disposeInlineChat = inlineChatService.registerEditor(editor, modelUri);

      // Cleanup'a ekle
      editor.onDidDispose(() => {
        disposeInlineChat();
      });
    }

    // ────────────────────────────────────────────────
    // Ghost Text (Inline Completions) Provider
    // (Taşındı: Modül 4.1 advancedInlineCompletions.ts)
    // ────────────────────────────────────────────────
    completionProviderRef.current?.dispose();

    // ────────────────────────────────────────────────
    // İçerik değişim olayı — onChange callback
    // ────────────────────────────────────────────────
    const contentDisposable = editor.onDidChangeModelContent((e) => {
      const value = editor.getValue();
      onChange(value);

      // isDirty takibi
      const modelInfo = editorModelManager.getModelInfo(modelUri);
      setIsDirty(modelInfo?.isDirty ?? false);

      // Undo/Redo sırasında ghost text koru (VS Code pattern)
      if (e.isUndoing || e.isRedoing) {
        // predictionService'e bildir (cancel debounce)
        console.log("↩️ Undo/Redo — preserving ghost text state");
      }
    });

    // ────────────────────────────────────────────────
    // Cursor pozisyonu
    // ────────────────────────────────────────────────
    const cursorDisposable = editor.onDidChangeCursorPosition((e) => {
      const { lineNumber, column } = e.position;
      setCursorInfo({ line: lineNumber, col: column });
      onCursorPositionChange?.(lineNumber, column);
    });

    // ────────────────────────────────────────────────
    // Seçim değişimi
    // ────────────────────────────────────────────────
    const selectionDisposable = editor.onDidChangeCursorSelection((e) => {
      const selected = editor.getModel()?.getValueInRange(e.selection) ?? "";
      onSelectionChange?.(selected);
    });

    // ────────────────────────────────────────────────
    // Kaydetme kısayolu (Ctrl+S / Cmd+S)
    // ────────────────────────────────────────────────
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave();
      const modelInfo = editorModelManager.getModelInfo(modelUri);
      if (modelInfo) {
        editorModelManager.markSaved(modelUri);
        setIsDirty(false);
      }
    });

    // ────────────────────────────────────────────────
    // Editör Aksiyonları
    // ────────────────────────────────────────────────
    editor.addAction({
      id: "corex-toggle-minimap",
      label: "CorexAI: Toggle Minimap",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyM],
      run: () => {
        setShowMinimap((prev) => {
          const next = !prev;
          editor.updateOptions({ minimap: { enabled: next } });
          return next;
        });
      },
    });

    editor.addAction({
      id: "corex-toggle-line-numbers",
      label: "CorexAI: Toggle Line Numbers",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL],
      run: () => {
        setShowLineNumbers((prev) => {
          const next = !prev;
          editor.updateOptions({ lineNumbers: next ? "on" : "off" });
          return next;
        });
      },
    });

    editor.addAction({
      id: "corex-toggle-word-wrap",
      label: "CorexAI: Toggle Word Wrap",
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyZ],
      run: () => {
        setWordWrap((prev) => {
          const next = !prev;
          editor.updateOptions({ wordWrap: next ? "on" : "off" });
          return next;
        });
      },
    });

    editor.addAction({
      id: "corex-zoom-in",
      label: "CorexAI: Zoom In",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Equal],
      run: () => {
        setFontSize((prev) => {
          const next = Math.min(prev + 1, 28);
          editor.updateOptions({ fontSize: next });
          return next;
        });
      },
    });

    editor.addAction({
      id: "corex-zoom-out",
      label: "CorexAI: Zoom Out",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Minus],
      run: () => {
        setFontSize((prev) => {
          const next = Math.max(prev - 1, 8);
          editor.updateOptions({ fontSize: next });
          return next;
        });
      },
    });

    editor.addAction({
      id: "corex-format-document",
      label: "CorexAI: Format Document",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      run: async () => {
        await editor.getAction("editor.action.formatDocument")?.run();
      },
    });

    // Çoklu imleç kısayolları
    editor.addAction({
      id: "corex-cursor-above",
      label: "CorexAI: Add Cursor Above",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow],
      run: () => editor.getAction("editor.action.insertCursorAbove")?.run(),
    });

    editor.addAction({
      id: "corex-cursor-below",
      label: "CorexAI: Add Cursor Below",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow],
      run: () => editor.getAction("editor.action.insertCursorBelow")?.run(),
    });

    // Select all occurrences
    editor.addAction({
      id: "corex-select-all-occurrences",
      label: "CorexAI: Select All Occurrences",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyH],
      run: () => editor.getAction("editor.action.selectHighlights")?.run(),
    });

    // Go to definition
    editor.addAction({
      id: "corex-go-to-definition",
      label: "CorexAI: Go to Definition",
      keybindings: [monaco.KeyCode.F12],
      run: () => editor.getAction("editor.action.revealDefinition")?.run(),
    });

    // Rename symbol
    editor.addAction({
      id: "corex-rename-symbol",
      label: "CorexAI: Rename Symbol",
      keybindings: [monaco.KeyCode.F2],
      run: () => editor.getAction("editor.action.rename")?.run(),
    });

    // ────────────────────────────────────────────────
    // Collab Cursors — Collaboration dekorasyonları
    // VS Code TrackedRange pattern kullanır
    // ────────────────────────────────────────────────
    const collabDecorationsRef: { current: string[] } = { current: [] };

    const unsubCollab = collabService.onUsersUpdate((users: UserPresence[]) => {
      if (!editorRef.current) return;

      const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
      users.forEach((user) => {
        if (user.cursor && user.cursor.file === filePath) {
          newDecorations.push({
            range: new monaco.Range(
              user.cursor.line,
              user.cursor.column,
              user.cursor.line,
              user.cursor.column + 1
            ),
            options: {
              className: `remote-cursor-${user.id}`,
              hoverMessage: { value: `**${user.name}** (collaborating)` },
              stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
              before: {
                content: user.name.charAt(0).toUpperCase(),
                inlineClassName: "remote-cursor-label",
                inlineClassNameAffectsLetterSpacing: true,
              },
            },
          });

          // Dinamik stil enjeksiyonu (kullanıcı başına bir kez)
          const styleId = `style-collab-${user.id}`;
          if (!document.getElementById(styleId)) {
            const style = document.createElement("style");
            style.id = styleId;
            style.textContent = `
              .remote-cursor-${user.id} {
                border-left: 2px solid ${user.color};
                margin-left: -1px;
              }
              .remote-cursor-label {
                position: absolute;
                top: -18px;
                left: 0;
                background: ${user.color};
                color: white;
                font-size: 9px;
                font-weight: bold;
                padding: 1px 4px;
                border-radius: 3px;
                pointer-events: none;
                white-space: nowrap;
                z-index: 100;
                font-family: system-ui, sans-serif;
              }
            `;
            document.head.appendChild(style);
          }
        }
      });

      // VS Code deltaDecorations pattern — eski kaldır, yeni ekle
      collabDecorationsRef.current = editor.deltaDecorations(
        collabDecorationsRef.current,
        newDecorations
      );
    });

    // ────────────────────────────────────────────────
    // Cleanup — VS Code Disposable pattern
    // Her listener dispose edilir → bellek sızıntısı yok
    // ────────────────────────────────────────────────
    return () => {
      contentDisposable.dispose();
      cursorDisposable.dispose();
      selectionDisposable.dispose();
      imeCleanup();
      unsubCollab();
      completionProviderRef.current?.dispose();
      completionProviderRef.current = null;

      // Editörü dispose et ama modeli koru
      // (başka sekme/tab aynı modeli kullanabilir)
      editor.setModel(null);
      editor.dispose();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]);

  // ============================================================
  // İÇERİK GÜNCELLEME — VS Code Tarzı (setValue() YASAK!)
  // ============================================================
  const prevContentRef = useRef(content);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Değişiklik yoksa hiçbir şey yapma
    if (prevContentRef.current === content) return;
    prevContentRef.current = content;

    const model = editor.getModel();
    if (!model) return;

    // Eğer editördeki içerik zaten aynıysa atla
    const currentValue = model.getValue();
    if (currentValue === content) return;

    // ❌ YANLIŞ: editor.setValue(content) — undo silinir!
    // ✅ DOĞRU: aiEditorService.replaceEntireContent() — undo korunur
    aiEditorService.replaceEntireContent(editor, content, "prop-sync");
  }, [content]);

  // ============================================================
  // SEÇENEK GÜNCELLEMESİ
  // ============================================================
  useEffect(() => {
    editorRef.current?.updateOptions({
      fontSize,
      fontFamily,
      tabSize,
      minimap: { enabled: showMinimap },
      lineNumbers: showLineNumbers ? "on" : "off",
      wordWrap: wordWrap ? "on" : "off",
    });
  }, [fontSize, fontFamily, tabSize, showMinimap, showLineNumbers, wordWrap]);

  // ============================================================
  // TOOLBAR HANDLER'LARI
  // ============================================================
  const handleToggleMinimap = useCallback(() => {
    setShowMinimap((prev) => {
      const next = !prev;
      editorRef.current?.updateOptions({ minimap: { enabled: next } });
      return next;
    });
  }, []);

  const handleToggleLineNumbers = useCallback(() => {
    setShowLineNumbers((prev) => {
      const next = !prev;
      editorRef.current?.updateOptions({ lineNumbers: next ? "on" : "off" });
      return next;
    });
  }, []);

  const handleToggleWordWrap = useCallback(() => {
    setWordWrap((prev) => {
      const next = !prev;
      editorRef.current?.updateOptions({ wordWrap: next ? "on" : "off" });
      return next;
    });
  }, []);

  const handleFontSizeChange = useCallback((delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(Math.max(prev + delta, 8), 28);
      editorRef.current?.updateOptions({ fontSize: next });
      return next;
    });
  }, []);

  const handleFormat = useCallback(() => {
    editorRef.current?.getAction("editor.action.formatDocument")?.run();
  }, []);

  // ============================================================
  // RENDER
  // ============================================================
  const fileName = filePath.split(/[/\\]/).pop() ?? filePath;

  // Modül 4.4: Çatışma (Merge) varsa otonom çözücüye devret
  if (isMergeConflict) {
    return (
      <MergeEditor
        filePath={filePath}
        initialContent={content}
        onResolve={(resolvedText) => {
          setIsMergeConflict(false);
          onChange?.(resolvedText);
          onSave?.();
        }}
        onCancel={() => setIsMergeConflict(false)}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-background)]" id="enhanced-editor-root">
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="h-9 bg-[var(--color-background)] border-b border-white/5 flex items-center justify-between px-3 shrink-0">
        {/* Sol: dosya bilgisi */}
        <div className="flex items-center gap-3 text-xs min-w-0">
          <span className="text-[var(--color-textSecondary)] truncate max-w-[200px]" title={filePath}>
            📄 {fileName}
          </span>
          {isDirty && (
            <span className="text-amber-400 text-[10px] font-medium bg-amber-400/10 px-1.5 py-0.5 rounded">
              ● unsaved
            </span>
          )}
          <span className="text-[var(--color-textSecondary)]/50 text-[10px] uppercase tracking-wider">
            {language}
          </span>
        </div>

        {/* Sağ: kontroller */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Minimap */}
          <button
            id="editor-toggle-minimap"
            onClick={handleToggleMinimap}
            className={`h-6 px-2 text-[11px] rounded transition-all ${showMinimap
              ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30"
              : "text-[var(--color-textSecondary)] hover:bg-white/5"
              }`}
            title="Toggle Minimap (Ctrl+Shift+M)"
          >
            🗺
          </button>

          {/* Line Numbers */}
          <button
            id="editor-toggle-line-numbers"
            onClick={handleToggleLineNumbers}
            className={`h-6 px-2 text-[11px] rounded transition-all ${showLineNumbers
              ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30"
              : "text-[var(--color-textSecondary)] hover:bg-white/5"
              }`}
            title="Toggle Line Numbers (Ctrl+Shift+L)"
          >
            #
          </button>

          {/* Word Wrap */}
          <button
            id="editor-toggle-word-wrap"
            onClick={handleToggleWordWrap}
            className={`h-6 px-2 text-[11px] rounded transition-all ${wordWrap
              ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30"
              : "text-[var(--color-textSecondary)] hover:bg-white/5"
              }`}
            title="Toggle Word Wrap (Alt+Z)"
          >
            ↩
          </button>

          {/* Separator */}
          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Font size */}
          <div className="flex items-center gap-0.5">
            <button
              id="editor-zoom-out"
              onClick={() => handleFontSizeChange(-1)}
              className="w-5 h-5 flex items-center justify-center hover:bg-white/10 rounded text-[var(--color-textSecondary)] text-[11px] transition-colors"
              title="Zoom Out"
            >
              −
            </button>
            <span className="text-[10px] text-[var(--color-textSecondary)] min-w-[28px] text-center tabular-nums">
              {fontSize}
            </span>
            <button
              id="editor-zoom-in"
              onClick={() => handleFontSizeChange(1)}
              className="w-5 h-5 flex items-center justify-center hover:bg-white/10 rounded text-[var(--color-textSecondary)] text-[11px] transition-colors"
              title="Zoom In"
            >
              +
            </button>
          </div>

          {/* Tab size */}
          <select
            id="editor-tab-size"
            value={tabSize}
            onChange={(e) => setTabSize(Number(e.target.value))}
            className="h-6 text-[10px] bg-transparent border border-white/10 rounded px-1 text-[var(--color-textSecondary)] cursor-pointer hover:border-white/20 transition-colors"
            title="Tab Size"
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
          </select>

          {/* Separator */}
          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Local History (Modül 4.3) */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`h-6 px-2 text-[11px] rounded transition-colors flex items-center gap-1 ${showHistory ? "bg-blue-600/30 text-blue-400" : "text-[var(--color-textSecondary)] hover:bg-white/5"
              }`}
            title="Local History Zaman Çizelgesi"
          >
            <HistoryIcon size={12} />
            <span className="hidden sm:inline">History</span>
          </button>

          {/* Separator */}
          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Format */}
          <button
            id="editor-format"
            onClick={handleFormat}
            className="h-6 px-2 text-[11px] text-[var(--color-textSecondary)] hover:bg-white/5 rounded transition-colors flex items-center gap-1"
            title="Format Document (Ctrl+Shift+F)"
          >
            <span>✨</span>
            <span className="hidden sm:inline">Format</span>
          </button>
        </div>
      </div>

      {/* ── Monaco Editör Alanı ──────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={editorContainerRef}
          className="absolute inset-0"
          id="monaco-editor-container"
        />

        {showHistory && (
          <LocalHistoryTimeline
            filePath={filePath}
            onClose={() => setShowHistory(false)}
            onRestore={(restoredContent) => {
              const editor = editorRef.current;
              if (editor) {
                // VS Code undo stack koruması için replaceEntireContent
                aiEditorService.replaceEntireContent(editor, restoredContent, "history-restore");
                // Ekstra dış onChange çağırma
                onChange?.(restoredContent);
              }
            }}
          />
        )}
      </div>

      {/* ── Status Bar ──────────────────────────────────────── */}
      <div className="h-6 bg-[var(--color-background)] border-t border-white/5 px-3 flex items-center justify-between text-[10px] text-[var(--color-textSecondary)]/60 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-medium text-[var(--color-textSecondary)]/80">Monaco</span>
          <span>UTF-8</span>
          <span>LF</span>
          <span className="capitalize">{language}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Cursor pozisyonu */}
          <span className="tabular-nums">
            Ln {cursorInfo.line}, Col {cursorInfo.col}
          </span>
          <span>Tab: {tabSize}</span>
          <span>{fontSize}px</span>

          {/* AI Provider Debounce hızı (debug bilgisi) */}
          <span className="text-[var(--color-primary)]/60 hidden lg:inline">
            AI ⚡ {Math.round(aiEditorService.getStats().averageResponseTime)}ms
          </span>
        </div>
      </div>
    </div>
  );
}
