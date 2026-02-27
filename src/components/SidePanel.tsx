import { useState } from "react";
import FileManager from "./FileManager";
import WorkspaceManager from "./WorkspaceManager";
import DatabaseBrowser from "./DatabaseBrowser";
import ApiTesting from "./ApiTesting";
import TaskManager from "./TaskManager";
import DockerIntegration from "./DockerIntegration";
import AccountsPanel from "./AccountsPanel";
import { MCPPanel } from "./MCPPanel";

import { useLanguage } from "../contexts/LanguageContext";
import { FileIndex } from '../types/index';
import TechDebtTracker from "./TechDebtTracker";
import SecurityFortress from "./SecurityFortress";
import ModelRoulette from "./ModelRoulette";
import PluginMarketplace from "./PluginMarketplace";
import InteractiveAcademy from "./InteractiveAcademy";
import { AIDebugAdvisor } from "./AIDebugAdvisor";
import { aiDebugService } from "../services/aiDebugService";

interface SidePanelProps {
  activeView: string;
  isVisible: boolean;
  width: number;
  onWidthChange: (width: number) => void;

  // File Manager props
  projectPath: string;
  files: string[];
  selectedFile: string;
  onFileSelect: (filePath: string) => void;
  onFileCreate: (filePath: string) => void;
  onFileDelete: (filePath: string) => void;
  onFileRename: (oldPath: string, newPath: string) => void;
  onRefresh: () => void;

  // Workspace Manager props
  onWorkspaceSelect?: (path: string) => void;
  onNewProject?: () => void;
  onOpenWorkspace?: () => void;
  onSettingsClick?: () => void;
  fileIndex?: FileIndex[];
}

export default function SidePanel({
  activeView,
  isVisible,
  width,
  onWidthChange,
  projectPath,
  files,
  selectedFile,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
  onRefresh,
  onWorkspaceSelect,
  onNewProject,
  onOpenWorkspace,
  onSettingsClick,
  fileIndex = [],
}: SidePanelProps) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Search functionality
  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    // Simulate search
    setTimeout(() => {
      const results = files
        .filter(file => file.toLowerCase().includes(term.toLowerCase()))
        .map(file => ({
          file,
          matches: [{ line: 1, text: `Found in ${file}` }],
        }));
      setSearchResults(results);
      setIsSearching(false);
    }, 500);
  };

  const renderSearchView = () => (
    <div className="h-full flex flex-col bg-[var(--color-background)]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("search.title")}</h2>

        {/* Search Input */}
        <div className="space-y-1.5">
          <input
            type="text"
            placeholder={t("search.placeholder")}
            value={searchTerm}
            onChange={e => handleSearch(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
          <input
            type="text"
            placeholder={t("search.includeFiles")}
            className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
          <input
            type="text"
            placeholder={t("search.excludeFiles")}
            className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>

        {/* Search Options */}
        <div className="mt-2 space-y-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="rounded" />
            <span>{t("search.matchCase")}</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="rounded" />
            <span>{t("search.wholeWord")}</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="rounded" />
            <span>{t("search.regex")}</span>
          </label>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {isSearching ? (
          <div className="text-center py-8 text-[var(--color-textSecondary)]">
            <div className="animate-spin text-2xl mb-2">⚙️</div>
            <p>{t("search.searching")}</p>
          </div>
        ) : searchResults.length > 0 ? (
          <div className="space-y-1.5">
            <div className="text-sm text-[var(--color-textSecondary)] mb-2">
              {searchResults.length} results in {searchResults.length} files
            </div>
            {searchResults.map((result: any, index: number) => (
              <div key={index} className="border border-[var(--color-border)] rounded">
                <div className="px-2 py-1.5 bg-[var(--color-background)] border-b border-[var(--color-border)]">
                  <button
                    onClick={() => onFileSelect(result.file)}
                    className="text-sm font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
                  >
                    📄 {result.file.split("/").pop()}
                  </button>
                  <div className="text-xs text-white/70">{result.file}</div>
                </div>
                {result.matches.map((match: any, matchIndex: number) => (
                  <div
                    key={matchIndex}
                    className="px-2 py-1.5 hover:bg-[var(--color-hover)] cursor-pointer"
                  >
                    <div className="text-xs text-[var(--color-textSecondary)]">
                      Line {match.line}
                    </div>
                    <div className="text-sm font-mono">{match.text}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : searchTerm ? (
          <div className="text-center py-8 text-[var(--color-textSecondary)]">
            <div className="text-2xl mb-2">🔍</div>
            <p>{t("search.noResults")}</p>
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--color-textSecondary)]">
            <div className="text-2xl mb-2">🔍</div>
            <p>{t("search.searchWorkspace")}</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSourceControlView = () => (
    <div className="h-full flex flex-col bg-[var(--color-background)]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("git.title")}</h2>

        {/* Repository Info */}
        <div className="mb-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--color-textSecondary)]">🌿</span>
            <span className="font-medium">main</span>
            <span className="text-[var(--color-textSecondary)]">•</span>
            <span className="text-[var(--color-textSecondary)]">origin/main</span>
          </div>
        </div>

        {/* Commit Message */}
        <div className="space-y-1.5">
          <textarea
            placeholder={t("git.commitMessage")}
            className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded text-sm resize-none focus:outline-none focus:border-[var(--color-primary)]"
            rows={3}
          />
          <button className="w-full px-3 py-2 bg-[var(--color-primary)] text-white rounded text-sm hover:opacity-80 transition-opacity">
            ✓ {t("git.commit")}
          </button>
        </div>
      </div>

      {/* Changes */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("git.changes")}</h3>
              <span className="text-xs bg-[var(--color-primary)] text-white px-2 py-0.5 rounded">
                3
              </span>
            </div>

            <div className="space-y-0.5">
              {["src/App.tsx", "src/components/ActivityBar.tsx", "package.json"].map(file => (
                <div
                  key={file}
                  className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-all duration-200 border border-transparent hover:border-[var(--neon-blue)] hover:shadow-[0_0_10px_rgba(0,243,255,0.2)] hover:bg-[var(--color-hover)] group"
                >
                  <span className="text-orange-500 text-xs">M</span>
                  <span className="text-sm flex-1 group-hover:text-white transition-colors">
                    {file.split("/").pop()}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="w-5 h-5 flex items-center justify-center hover:bg-[var(--color-background)] rounded text-xs text-[var(--neon-blue)]">
                      +
                    </button>
                    <button className="w-5 h-5 flex items-center justify-center hover:bg-[var(--color-background)] rounded text-xs text-[var(--neon-purple)]">
                      ↶
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">
                {t("git.stagedChanges")}
              </h3>
              <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">1</span>
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--color-hover)] rounded cursor-pointer">
                <span className="text-green-500 text-xs">A</span>
                <span className="text-sm flex-1">README.md</span>
                <button className="w-5 h-5 flex items-center justify-center hover:bg-[var(--color-background)] rounded text-xs">
                  -
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRunDebugView = () => (
    <div className="h-full flex flex-col bg-[var(--color-background)]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
          {t("activity.runDebug")}
        </h2>

        {/* Run Button */}
        <button className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors mb-2">
          ▶️ {t("common.run")}
        </button>

        {/* Configuration */}
        <div>
          <select className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded text-sm">
            <option>{t("debug.launchProgram")}</option>
            <option>{t("debug.attachProcess")}</option>
            <option>{t("debug.launchChrome")}</option>
          </select>
        </div>
      </div>

      {/* Debug Info */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1">
              {t("debug.variables")}
            </h3>
            <div className="text-sm text-[var(--color-textSecondary)]">
              {t("debug.noVariables")}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1">
              {t("debug.watch")}
            </h3>
            <div className="text-sm text-[var(--color-textSecondary)]">{t("debug.noWatch")}</div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1">
              {t("debug.callStack")}
            </h3>
            <div className="text-sm text-[var(--color-textSecondary)]">{t("debug.notPaused")}</div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1">
              {t("debug.breakpoints")}
            </h3>
            <div className="text-sm text-[var(--color-textSecondary)]">
              {t("debug.noBreakpoints")}
            </div>
          </div>
        </div>

        {/* AI Debug Advisor Integration */}
        <AIDebugAdvisor />

        {/* Trigger Mock Debug (for demo) */}
        <div className="mt-8 border-t border-[var(--color-border)] pt-4">
          <button
            onClick={() => aiDebugService.triggerMockBreakpoint(selectedFile || "App.tsx", 124)}
            className="w-full py-2 border border-indigo-500/30 text-indigo-400 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-indigo-500/10 transition-all"
          >
            AI Debug Testini Başlat
          </button>
          <p className="text-[9px] text-neutral-500 mt-2 text-center">
            Gerçek bir breakpoint simülasyonu yapar.
          </p>
        </div>
      </div>
    </div>
  );

  const renderSettingsView = () => (
    <div className="h-full flex flex-col bg-[var(--color-background)]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
          {t("settings.title")}
        </h2>

        {/* Search Settings */}
        <input
          type="text"
          placeholder={t("settings.searchSettings")}
          className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      {/* Settings Categories */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 space-y-2">
          {[
            { icon: "👤", title: t("settings.user"), description: t("settings.userDesc") },
            {
              icon: "📁",
              title: t("settings.workspace"),
              description: t("settings.workspaceDesc"),
            },
            {
              icon: "🎨",
              title: t("settings.appearance"),
              description: t("settings.appearanceDesc"),
            },
            { icon: "⌨️", title: t("settings.keyboard"), description: t("settings.keyboardDesc") },
            { icon: "🧩", title: t("extensions.title"), description: t("settings.extensionsDesc") },
            { icon: "🔧", title: t("settings.features"), description: t("settings.featuresDesc") },
            { icon: "🌐", title: t("settings.remote"), description: t("settings.remoteDesc") },
            { icon: "🔒", title: t("settings.security"), description: t("settings.securityDesc") },
          ].map((category, index) => (
            <div
              key={index}
              className="p-2.5 border border-[var(--color-border)] rounded hover:border-[var(--color-primary)] cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{category.icon}</span>
                <div>
                  <h3 className="font-semibold text-[var(--color-text)]">{category.title}</h3>
                  <p className="text-sm text-[var(--color-textSecondary)]">
                    {category.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeView) {
      case "explorer":
        return (
          <FileManager
            projectPath={projectPath}
            files={files}
            selectedFile={selectedFile}
            onFileSelect={onFileSelect}
            onFileCreate={onFileCreate}
            onFileDelete={onFileDelete}
            onFileRename={onFileRename}
            onRefresh={onRefresh}
            onNewProject={onNewProject}
            onOpenWorkspace={onOpenWorkspace}
          />
        );
      case "search":
        return renderSearchView();
      case "source-control":
        return renderSourceControlView();
      case "run-debug":
        return renderRunDebugView();
      case "extensions":
      case "marketplace":
        return <PluginMarketplace />;
      case "accounts":
        return <AccountsPanel />;
      case "settings":
        return renderSettingsView();
      case "workspace":
        return (
          <WorkspaceManager
            currentProjectPath={projectPath}
            onWorkspaceSelect={onWorkspaceSelect || (() => { })}
          />
        );
      case "database":
        return <DatabaseBrowser />;
      case "api-testing":
        return <ApiTesting />;
      case "tasks":
        return <TaskManager />;
      case "docker":
        return <DockerIntegration />;
      case "mcp":
        return <MCPPanel />;
      case "tech-debt":
        return <TechDebtTracker fileIndex={fileIndex} onFileClick={onFileSelect} />;
      case "security-fortress":
        return <SecurityFortress fileIndex={fileIndex} onFileClick={onFileSelect} />;
      case "model-roulette":
        return <ModelRoulette />;
      case "academy":
        return <InteractiveAcademy selectedFile={selectedFile} />;
      case "compare":
        return (
          <div className="p-4 text-xs text-neutral-400">
            Model karşılaştırma modu aktif. Ana panelden devam edin.
          </div>
        );

      default:
        return null;
    }
  };

  if (!isVisible || !activeView) return null;

  return (
    <div
      className="h-full flex transition-all duration-300 ease-in-out relative z-20 glass-panel border-r-0"
      style={{ width: `${width}px` }}
    >
      {/* Content */}
      <div className="flex-1 overflow-hidden">{renderContent()}</div>

      {/* Settings Button */}
      {onSettingsClick && (
        <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
          <button
            onClick={onSettingsClick}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--color-hover)] transition-colors text-white/70 hover:text-white"
          >
            <span>⚙️</span>
            <span className="text-xs font-medium">Ayarlar</span>
          </button>
        </div>
      )}

      {/* Resize Handle */}
      <div
        className="w-1 bg-transparent hover:bg-[var(--color-primary)] cursor-ew-resize transition-colors flex-shrink-0"
        onMouseDown={e => {
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = width;

          const handleMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = startWidth + (moveEvent.clientX - startX);
            const clampedWidth = Math.max(200, Math.min(600, newWidth));
            onWidthChange(clampedWidth);
          };

          const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
          };

          document.addEventListener("mousemove", handleMouseMove);
          document.addEventListener("mouseup", handleMouseUp);
        }}
      />
    </div>
  );
}
