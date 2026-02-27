import { useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor";
import { predictionService } from "../services/predictionService";
import { collabService, UserPresence } from "../services/collaborationService";

interface EnhancedEditorProps {
  filePath: string;
  content: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCursorPositionChange?: (line: number, column: number) => void;
  onSelectionChange?: (selection: string) => void;
}

export default function EnhancedEditor({
  filePath,
  content,
  onChange,
  onSave,
  onCursorPositionChange,
  onSelectionChange,
}: EnhancedEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [tabSize, setTabSize] = useState(2);

  // Initialize Monaco Editor
  useEffect(() => {
    if (!editorRef.current) return;

    // Get file language from extension
    const getLanguage = (path: string) => {
      const ext = path.split(".").pop()?.toLowerCase();
      const languageMap: Record<string, string> = {
        ts: "typescript",
        tsx: "typescript",
        js: "javascript",
        jsx: "javascript",
        rs: "rust",
        py: "python",
        json: "json",
        md: "markdown",
        css: "css",
        scss: "scss",
        html: "html",
        xml: "xml",
        yaml: "yaml",
        yml: "yaml",
        toml: "toml",
        sql: "sql",
        sh: "shell",
        bat: "bat",
        ps1: "powershell",
      };
      return languageMap[ext || ""] || "plaintext";
    };

    const language = getLanguage(filePath);

    // Create editor
    const editor = monaco.editor.create(editorRef.current, {
      value: content,
      language,
      theme: "vs-dark",
      fontSize,
      tabSize,
      insertSpaces: true,
      detectIndentation: true,
      automaticLayout: true,
      minimap: { enabled: showMinimap },
      lineNumbers: showLineNumbers ? "on" : "off",
      wordWrap: wordWrap ? "on" : "off",
      folding: true,
      foldingStrategy: "indentation",
      showFoldingControls: "always",
      renderWhitespace: "selection",
      renderControlCharacters: true,
      cursorBlinking: "blink",
      cursorSmoothCaretAnimation: "on",
      smoothScrolling: true,
      mouseWheelZoom: true,
      multiCursorModifier: "ctrlCmd",
      selectionHighlight: true,
      occurrencesHighlight: "singleFile",
      codeLens: true,
      colorDecorators: true,
      quickSuggestions: {
        other: true,
        comments: false,
        strings: false,
      },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: "on",
      acceptSuggestionOnCommitCharacter: true,
      snippetSuggestions: "top",
      emptySelectionClipboard: false,
      copyWithSyntaxHighlighting: true,
      useTabStops: true,
      wordBasedSuggestions: "matchingDocuments",
      guides: {
        bracketPairs: true,
        bracketPairsHorizontal: true,
        highlightActiveBracketPair: true,
        indentation: true,
        highlightActiveIndentation: true,
      },
      inlineSuggest: { enabled: true },
      stickyScroll: { enabled: true },
    });

    monacoRef.current = editor;

    // 🔮 Predictive Coding (Ghost Text) Entegrasyonu
    const completionProvider = monaco.languages.registerInlineCompletionsProvider(language, {
      provideInlineCompletions: async (model, position) => {
        const text = await predictionService.getCompletion(
          model.getValue(),
          position.lineNumber,
          position.column,
          filePath
        );

        if (!text) return { items: [] };

        return {
          items: [
            {
              insertText: text,
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
            },
          ],
        };
      },
      handleItemDidShow: () => { },
      disposeInlineCompletions: () => { },
    });

    // Handle content changes
    const disposable = editor.onDidChangeModelContent(() => {
      const value = editor.getValue();
      onChange(value);
    });

    // Handle cursor position changes
    const cursorDisposable = editor.onDidChangeCursorPosition((e: any) => {
      onCursorPositionChange?.(e.position.lineNumber, e.position.column);
    });

    const selectionDisposable = editor.onDidChangeCursorSelection((e: any) => {
      const selection = editor.getModel()?.getValueInRange(e.selection);
      onSelectionChange?.(selection || "");
    });

    // Handle save shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave();
    });

    // Add custom actions
    editor.addAction({
      id: "toggle-minimap",
      label: "Toggle Minimap",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyM],
      run: () => {
        setShowMinimap(prev => {
          const newValue = !prev;
          editor.updateOptions({ minimap: { enabled: newValue } });
          return newValue;
        });
      },
    });

    editor.addAction({
      id: "toggle-line-numbers",
      label: "Toggle Line Numbers",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL],
      run: () => {
        setShowLineNumbers(prev => {
          const newValue = !prev;
          editor.updateOptions({ lineNumbers: newValue ? "on" : "off" });
          return newValue;
        });
      },
    });

    editor.addAction({
      id: "toggle-word-wrap",
      label: "Toggle Word Wrap",
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyZ],
      run: () => {
        setWordWrap(prev => {
          const newValue = !prev;
          editor.updateOptions({ wordWrap: newValue ? "on" : "off" });
          return newValue;
        });
      },
    });

    // Zoom in/out
    editor.addAction({
      id: "zoom-in",
      label: "Zoom In",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Equal],
      run: () => {
        setFontSize(prev => {
          const newSize = Math.min(prev + 1, 24);
          editor.updateOptions({ fontSize: newSize });
          return newSize;
        });
      },
    });

    editor.addAction({
      id: "zoom-out",
      label: "Zoom Out",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Minus],
      run: () => {
        setFontSize(prev => {
          const newSize = Math.max(prev - 1, 8);
          editor.updateOptions({ fontSize: newSize });
          return newSize;
        });
      },
    });

    // Format document
    editor.addAction({
      id: "format-document",
      label: "Format Document",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      run: async () => {
        await editor.getAction("editor.action.formatDocument")?.run();
      },
    });

    // Multi-cursor shortcuts
    editor.addAction({
      id: "add-cursor-above",
      label: "Add Cursor Above",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow],
      run: () => {
        editor.getAction("editor.action.insertCursorAbove")?.run();
      },
    });

    editor.addAction({
      id: "add-cursor-below",
      label: "Add Cursor Below",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow],
      run: () => {
        editor.getAction("editor.action.insertCursorBelow")?.run();
      },
    });

    // 🌐 Collaboration Cursors
    const decorationsRef = { current: [] as string[] };
    const unsubCollabUsers = collabService.onUsersUpdate((users: UserPresence[]) => {
      if (!monacoRef.current) return;

      const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
      users.forEach(user => {
        if (user.cursor && user.cursor.file === filePath) {
          newDecorations.push({
            range: new monaco.Range(user.cursor.line, user.cursor.column, user.cursor.line, user.cursor.column + 1),
            options: {
              className: `remote-cursor-${user.id}`,
              hoverMessage: { value: `**${user.name}**` },
              before: {
                content: user.name.charAt(0).toUpperCase(),
                inlineClassName: 'remote-cursor-label',
                inlineClassNameAffectsLetterSpacing: true
              }
            }
          });

          // Add dynamic style for this user if not already present
          const styleId = `style-collab-${user.id}`;
          if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
              .remote-cursor-${user.id} {
                border-left: 2px solid ${user.color};
                margin-left: -1px;
                position: relative;
              }
              .remote-cursor-label {
                position: absolute;
                top: -14px;
                left: 0;
                background: ${user.color};
                color: white;
                font-size: 9px;
                font-weight: bold;
                padding: 0 4px;
                border-radius: 2px;
                pointer-events: none;
                white-space: nowrap;
                z-index: 10;
              }
            `;
            document.head.appendChild(style);
          }
        }
      });

      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
    });

    // Cleanup
    return () => {
      disposable.dispose();
      cursorDisposable.dispose();
      selectionDisposable.dispose();
      completionProvider.dispose();
      unsubCollabUsers();
      editor.dispose();
    };
  }, [filePath]);

  // Update content when prop changes
  useEffect(() => {
    if (monacoRef.current && monacoRef.current.getValue() !== content) {
      monacoRef.current.setValue(content);
    }
  }, [content]);

  // Update editor options
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.updateOptions({
        fontSize,
        tabSize,
        minimap: { enabled: showMinimap },
        lineNumbers: showLineNumbers ? "on" : "off",
        wordWrap: wordWrap ? "on" : "off",
      });
    }
  }, [fontSize, tabSize, showMinimap, showLineNumbers, wordWrap]);

  return (
    <div className="h-full flex flex-col bg-[var(--color-background)]">
      {/* Editor Toolbar */}
      <div className="h-8 bg-[var(--color-background)] border-b border-white/5 flex items-center justify-between px-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--color-textSecondary)]">📄 {filePath.split("/").pop()}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Editor Options */}
          <button
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            className={`px-2 py-1 text-xs rounded transition-colors ${showLineNumbers
              ? "bg-[var(--color-primary)] text-white"
              : "hover:bg-[var(--color-hover)]"
              }`}
            title="Toggle Line Numbers (Ctrl+Shift+L)"
          >
            #
          </button>

          <button
            onClick={() => setShowMinimap(!showMinimap)}
            className={`px-2 py-1 text-xs rounded transition-colors ${showMinimap ? "bg-[var(--color-primary)] text-white" : "hover:bg-[var(--color-hover)]"
              }`}
            title="Toggle Minimap (Ctrl+Shift+M)"
          >
            🗺️
          </button>

          <button
            onClick={() => setWordWrap(!wordWrap)}
            className={`px-2 py-1 text-xs rounded transition-colors ${wordWrap ? "bg-[var(--color-primary)] text-white" : "hover:bg-[var(--color-hover)]"
              }`}
            title="Toggle Word Wrap (Alt+Z)"
          >
            ↩️
          </button>

          {/* Font Size Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const newSize = Math.max(fontSize - 1, 8);
                setFontSize(newSize);
              }}
              className="w-6 h-6 flex items-center justify-center hover:bg-[var(--color-hover)] rounded text-xs"
              title="Zoom Out (Ctrl+-)"
            >
              -
            </button>
            <span className="text-xs text-[var(--color-textSecondary)] min-w-[2rem] text-center">
              {fontSize}px
            </span>
            <button
              onClick={() => {
                const newSize = Math.min(fontSize + 1, 24);
                setFontSize(newSize);
              }}
              className="w-6 h-6 flex items-center justify-center hover:bg-[var(--color-hover)] rounded text-xs"
              title="Zoom In (Ctrl++)"
            >
              +
            </button>
          </div>

          {/* Tab Size */}
          <select
            value={tabSize}
            onChange={e => setTabSize(Number(e.target.value))}
            className="text-xs bg-[var(--color-background)] border border-[var(--color-border)] rounded px-1 py-0.5"
            title="Tab Size"
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
          </select>

          {/* Format Button */}
          <button
            onClick={() => {
              monacoRef.current?.getAction("editor.action.formatDocument")?.run();
            }}
            className="px-2 py-1 text-xs hover:bg-[var(--color-hover)] rounded transition-colors"
            title="Format Document (Ctrl+Shift+F)"
          >
            🎨
          </button>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div ref={editorRef} className="flex-1" />

      {/* Editor Status */}
      <div className="h-6 bg-[var(--color-background)] border-t border-white/5 px-3 flex items-center justify-between text-xs text-[var(--color-textSecondary)]">
        <div className="flex items-center gap-4">
          <span>Monaco Editor</span>
          <span>UTF-8</span>
          <span>LF</span>
        </div>

        <div className="flex items-center gap-4">
          <span>Tab Size: {tabSize}</span>
          <span>Font: {fontSize}px</span>
          <span>
            {showLineNumbers ? "# " : ""}
            {showMinimap ? "🗺️ " : ""}
            {wordWrap ? "↩️" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
