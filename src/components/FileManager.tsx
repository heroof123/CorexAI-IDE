import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { markersService } from "../services/markersService";
import { markersFileDecoration } from "../services/markersFileDecoration";
import { generateTemplate } from "../services/fileTemplateSnippets";

interface FileManagerProps {
  projectPath: string;
  files: string[];
  selectedFile: string;
  onFileSelect: (filePath: string) => void;
  onFileCreate: (filePath: string) => void;
  onFileDelete: (filePath: string) => void;
  onFileRename: (oldPath: string, newPath: string) => void;
  onRefresh: () => void;
  onNewProject?: () => void;
  onOpenWorkspace?: () => void;
}

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
  isExpanded?: boolean;
}

export default function FileManager({
  projectPath,
  files,
  selectedFile,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
  onRefresh,
  onNewProject,
  onOpenWorkspace,
}: FileManagerProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileNode;
  } | null>(null);
  const [draggedFile, setDraggedFile] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredFiles, setFilteredFiles] = useState<string[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState<{
    type: "file" | "folder";
    parentPath: string;
  } | null>(null);
  const [renameFile, setRenameFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, setMarkersTick] = useState(0);

  useEffect(() => {
    const unsubscribe = markersService.onDidChangeMarkers(() => {
      setMarkersTick(t => t + 1);
    });
    return unsubscribe;
  }, []);

  // Sahte (Mock) karmaşıklık hesaplayıcı - Path string'ine göre hash üretip renk döner
  const getHeatmapColor = (filePath: string) => {
    let hash = 0;
    for (let i = 0; i < filePath.length; i++) {
      hash = filePath.charCodeAt(i) + ((hash << 5) - hash);
    }
    const normalized = Math.abs(hash % 100); // 0-99

    if (normalized > 80) return "rgba(239, 68, 68, 0.25)"; // 🔥 SICAK 
    if (normalized > 50) return "rgba(245, 158, 11, 0.2)"; // ⚠️ ILIK
    return undefined; // ❄️ SOĞUK (Mavi - Temiz/Stabil - YERİNE BOŞ GÖSTER)
  };

  // Build file tree from flat file list
  useEffect(() => {
    if (!files.length) return;

    const buildTree = (paths: string[]): FileNode[] => {
      const tree: FileNode[] = [];
      const pathMap = new Map<string, FileNode>();

      // Normalize projectPath for comparison
      const normalizedProjectPath = projectPath.replace(/\\/g, '/').toLowerCase();

      // Sort paths to ensure directories come before their contents
      const sortedPaths = [...paths].sort();

      for (const path of sortedPaths) {
        const normalizedPath = path.replace(/\\/g, '/');
        let relativePath = normalizedPath;

        if (normalizedPath.toLowerCase().startsWith(normalizedProjectPath)) {
          relativePath = normalizedPath.substring(normalizedProjectPath.length).replace(/^[\\/]/, "");
        } else {
          relativePath = normalizedPath.replace(/^[\\/]/, "");
        }

        const parts = relativePath.split('/');
        if (parts[0] === "") parts.shift(); // Handle leading slash if any

        let currentFullPath = projectPath.replace(/\\/g, '/');

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (!part) continue;

          const fullPath = currentFullPath + "/" + part;
          const isDirectory = i < parts.length - 1 || path.endsWith("/");

          if (!pathMap.has(fullPath)) {
            const node: FileNode = {
              name: part,
              path: fullPath,
              isDirectory,
              children: isDirectory ? [] : undefined,
              isExpanded: false,
            };

            pathMap.set(fullPath, node);

            if (i === 0) {
              tree.push(node);
            } else {
              const parentPath = currentFullPath;
              const parent = pathMap.get(parentPath);
              if (parent && parent.children) {
                parent.children.push(node);
              }
            }
          }

          currentFullPath = fullPath;
        }
      }

      return tree;
    };

    setFileTree(buildTree(files));
  }, [files, projectPath]);

  // Filter files based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredFiles(files);
    } else {
      const filtered = files.filter(file => file.toLowerCase().includes(searchTerm.toLowerCase()));
      setFilteredFiles(filtered);
    }
  }, [files, searchTerm]);

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node,
    });
  };

  const handleCreateFile = async (name: string, type: "file" | "folder") => {
    if (!showCreateDialog) return;

    const fullPath = `${showCreateDialog.parentPath}/${name}`;

    try {
      if (type === "folder") {
        await invoke("create_directory", { path: fullPath });
      } else {
        const content = generateTemplate(name) || "";
        await invoke("write_file", { path: fullPath, content });
      }

      onFileCreate(fullPath);
      setShowCreateDialog(null);
      onRefresh();
    } catch (error) {
      alert(`Oluşturma hatası: ${error}`);
    }
  };

  const handleDeleteFile = async (filePath: string) => {
    if (!confirm(`"${filePath.split("/").pop()}" dosyasını silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      await invoke("delete_file", { path: filePath });
      onFileDelete(filePath);
      onRefresh();
    } catch (error) {
      alert(`Silme hatası: ${error}`);
    }
  };

  const handleRenameFile = async (oldPath: string, newName: string) => {
    const directory = oldPath.substring(0, oldPath.lastIndexOf("/"));
    const newPath = `${directory}/${newName}`;

    try {
      await invoke("rename_file", { oldPath, newPath });
      onFileRename(oldPath, newPath);
      setRenameFile(null);
      onRefresh();
    } catch (error) {
      alert(`Yeniden adlandırma hatası: ${error}`);
    }
  };

  const handleDragStart = (e: React.DragEvent, filePath: string) => {
    setDraggedFile(filePath);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();

    if (!draggedFile) return;

    const fileName = draggedFile.split("/").pop();
    const newPath = `${targetPath}/${fileName}`;

    try {
      await invoke("move_file", { oldPath: draggedFile, newPath });
      onFileRename(draggedFile, newPath);
      setDraggedFile(null);
      onRefresh();
    } catch (error) {
      alert(`Taşıma hatası: ${error}`);
    }
  };

  const toggleExpanded = (path: string) => {
    setFileTree(prev => {
      const updateNode = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
          if (node.path === path) {
            return { ...node, isExpanded: !node.isExpanded };
          }
          if (node.children) {
            return { ...node, children: updateNode(node.children) };
          }
          return node;
        });
      };
      return updateNode(prev);
    });
  };

  const renderFileNode = (node: FileNode, depth = 0) => {
    const isSelected = selectedFile === node.path;
    const isRenamed = renameFile === node.path;
    const decoration = markersFileDecoration.getFileDecoration(node.path);

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-all duration-200 border border-transparent rounded-lg hover:border-[var(--neon-blue)] hover:shadow-[0_0_10px_rgba(0,243,255,0.2)] hover:bg-[var(--color-hover)] group ${isSelected
            ? "bg-[var(--color-primary)] text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
            : ""
            }`}
          style={{
            paddingLeft: `${depth * 16 + 8}px`,
            backgroundColor: !node.isDirectory && !isSelected ? getHeatmapColor(node.path) : undefined
          }}
          onClick={() => !node.isDirectory && onFileSelect(node.path)}
          onContextMenu={e => handleContextMenu(e, node)}
          onDragStart={e => handleDragStart(e, node.path)}
          onDragOver={handleDragOver}
          onDrop={e => node.isDirectory && handleDrop(e, node.path)}
          draggable={!node.isDirectory}
        >
          {node.isDirectory && (
            <button
              onClick={e => {
                e.stopPropagation();
                toggleExpanded(node.path);
              }}
              className="w-4 h-4 flex items-center justify-center"
            >
              {node.isExpanded ? "📂" : "📁"}
            </button>
          )}

          {!node.isDirectory && (
            <span className="w-4 h-4 flex items-center justify-center text-xs">
              {node.name.endsWith(".ts") || node.name.endsWith(".tsx")
                ? "🟦"
                : node.name.endsWith(".js") || node.name.endsWith(".jsx")
                  ? "🟨"
                  : node.name.endsWith(".rs")
                    ? "🦀"
                    : node.name.endsWith(".py")
                      ? "🐍"
                      : node.name.endsWith(".json")
                        ? "📋"
                        : node.name.endsWith(".md")
                          ? "📝"
                          : node.name.endsWith(".css")
                            ? "🎨"
                            : node.name.endsWith(".html")
                              ? "🌐"
                              : "📄"}
            </span>
          )}

          {isRenamed ? (
            <input
              type="text"
              defaultValue={node.name}
              className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs"
              onBlur={e => {
                if (e.target.value !== node.name) {
                  handleRenameFile(node.path, e.target.value);
                } else {
                  setRenameFile(null);
                }
              }}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  setRenameFile(null);
                }
              }}
              autoFocus
            />
          ) : (
            <>
              <span
                className="flex-1 text-xs truncate text-white/80 group-hover:text-white"
                style={{ color: decoration?.color }}
                title={decoration?.tooltip}
              >
                {node.name}
              </span>
              {decoration?.badge && (
                <span
                  className="text-[9px] font-bold px-1 rounded ml-1"
                  style={{ backgroundColor: decoration.color, color: '#fff' }}
                  title={decoration.tooltip}
                >
                  {decoration.badge}
                </span>
              )}
              {!node.isDirectory && isSelected && (
                <span className="text-xs text-[var(--color-primary)] ml-1">▶</span>
              )}
            </>
          )}
        </div>

        {node.isDirectory && node.isExpanded && node.children && (
          <div>{node.children.map(child => renderFileNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Header */}
      <div className="p-3 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-white/80 uppercase tracking-[0.2em]">Explorer</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowCreateDialog({ type: "file", parentPath: projectPath })}
              className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg text-xs transition-colors group"
              title="Yeni Dosya"
            >
              <span className="group-hover:neon-text transition-all">📄</span>
            </button>
            <button
              onClick={() => setShowCreateDialog({ type: "folder", parentPath: projectPath })}
              className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg text-xs transition-colors group"
              title="Yeni Klasör"
            >
              <span className="group-hover:neon-text transition-all">📁</span>
            </button>
            <button
              onClick={onRefresh}
              className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg text-xs transition-colors group"
              title="Yenile"
            >
              <span className="group-hover:neon-text transition-all">🔄</span>
            </button>
          </div>
        </div>

        {/* Project Context - Integrated */}
        <div className="flex flex-col gap-1 mb-4">
          <button
            onClick={onNewProject}
            className="flex items-center gap-2 px-3 py-2 bg-green-600/10 text-green-400 border border-green-600/20 rounded-lg text-[11px] font-bold hover:bg-green-600/20 transition-all group"
          >
            <span className="text-sm group-hover:scale-110 transition-transform">➕</span> Yeni
            Proje Oluştur
          </button>
          <button
            onClick={onOpenWorkspace}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600/10 text-blue-400 border border-blue-600/20 rounded-lg text-[11px] font-bold hover:bg-blue-600/20 transition-all group"
          >
            <span className="text-sm group-hover:scale-110 transition-transform">📂</span> Çalışma
            Alanı Aç
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Dosya ara..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full px-2 py-1 text-xs bg-[var(--color-background)] border border-[var(--color-border)] rounded focus:border-[var(--color-primary)] outline-none"
        />
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto">
        {searchTerm ? (
          // Search results
          <div className="p-2">
            <div className="text-xs text-[var(--color-textSecondary)] mb-2">
              {filteredFiles.length} sonuç bulundu
            </div>
            {filteredFiles.map(file => (
              <div
                key={file}
                className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-[var(--color-hover)] rounded ${selectedFile === file ? "bg-[var(--color-primary)] text-white" : ""
                  }`}
                onClick={() => onFileSelect(file)}
              >
                <span className="text-xs">📄</span>
                <span className="text-xs truncate text-white/80">
                  {file.replace(projectPath, "").replace(/^[\\/]/, "")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          // File tree
          <div>{fileTree.map(node => renderFileNode(node))}</div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed bg-[#121216] border border-white/10 rounded shadow-2xl z-50 py-1 backdrop-blur-3xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {!contextMenu.node.isDirectory && (
              <button
                onClick={() => {
                  onFileSelect(contextMenu.node.path);
                  setContextMenu(null);
                }}
                className="block w-full text-left px-3 py-1 text-xs hover:bg-[var(--color-hover)]"
              >
                📂 Aç
              </button>
            )}
            <button
              onClick={() => {
                setRenameFile(contextMenu.node.path);
                setContextMenu(null);
              }}
              className="block w-full text-left px-3 py-1 text-xs hover:bg-[var(--color-hover)]"
            >
              ✏️ Yeniden Adlandır
            </button>
            <button
              onClick={() => {
                handleDeleteFile(contextMenu.node.path);
                setContextMenu(null);
              }}
              className="block w-full text-left px-3 py-1 text-xs hover:bg-[var(--color-hover)] text-[var(--color-error)]"
            >
              🗑️ Sil
            </button>
            <div className="border-t border-[var(--color-border)] my-1" />
            <button
              onClick={() => {
                setShowCreateDialog({
                  type: "file",
                  parentPath: contextMenu.node.isDirectory
                    ? contextMenu.node.path
                    : contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf("/")),
                });
                setContextMenu(null);
              }}
              className="block w-full text-left px-3 py-1 text-xs hover:bg-[var(--color-hover)]"
            >
              📄 Yeni Dosya
            </button>
            <button
              onClick={() => {
                setShowCreateDialog({
                  type: "folder",
                  parentPath: contextMenu.node.isDirectory
                    ? contextMenu.node.path
                    : contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf("/")),
                });
                setContextMenu(null);
              }}
              className="block w-full text-left px-3 py-1 text-xs hover:bg-[var(--color-hover)]"
            >
              📁 Yeni Klasör
            </button>
            <div className="border-t border-[var(--color-border)] my-1" />
            <button
              onClick={() => {
                invoke("open_new_window", { path: "index.html" }).catch(console.error);
                setContextMenu(null);
              }}
              className="block w-full text-left px-3 py-1 text-xs hover:bg-[var(--color-hover)]"
            >
              🪟 Yeni Pencere
            </button>
          </div>
        </>
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" />
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-[#121216] border border-white/10 rounded-xl p-4 w-80 shadow-2xl backdrop-blur-3xl">
              <h3 className="text-sm font-semibold mb-3">
                {showCreateDialog.type === "file" ? "📄 Yeni Dosya" : "📁 Yeni Klasör"}
              </h3>
              <input
                ref={fileInputRef}
                type="text"
                placeholder={showCreateDialog.type === "file" ? "dosya.txt" : "klasor-adi"}
                className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded focus:border-[var(--color-primary)] outline-none text-sm"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    handleCreateFile(e.currentTarget.value, showCreateDialog.type);
                  } else if (e.key === "Escape") {
                    setShowCreateDialog(null);
                  }
                }}
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => setShowCreateDialog(null)}
                  className="px-3 py-1 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
                >
                  İptal
                </button>
                <button
                  onClick={() => {
                    const input = fileInputRef.current;
                    if (input?.value) {
                      handleCreateFile(input.value, showCreateDialog.type);
                    }
                  }}
                  className="px-3 py-1 text-xs bg-[var(--color-primary)] text-white rounded hover:opacity-80"
                >
                  Oluştur
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
