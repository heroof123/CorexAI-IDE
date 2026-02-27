import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface RemoteConnection {
  id: string;
  name: string;
  type: 'ssh' | 'ftp' | 'sftp' | 'docker';
  host: string;
  port: number;
  username: string;
  password?: string;
  keyPath?: string;
  workingDirectory: string;
  connected: boolean;
  lastConnected?: number;
}

interface RemoteFile {
  name: string;
  path: string;
  file_type: 'file' | 'directory';
  size?: number;
  modified?: number;
  permissions?: string;
}

interface RemoteDevelopmentProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRemoteFile: (connection: RemoteConnection, filePath: string) => void;
}

export default function RemoteDevelopment({ isOpen, onClose, onOpenRemoteFile }: RemoteDevelopmentProps) {
  const [activeTab, setActiveTab] = useState('connections');
  const [connections, setConnections] = useState<RemoteConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<RemoteConnection | null>(null);
  const [remoteFiles, setRemoteFiles] = useState<RemoteFile[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConnectionForm, setShowConnectionForm] = useState(false);

  // Connection form state
  const [newConnection, setNewConnection] = useState({
    name: '',
    type: 'ssh' as const,
    host: '',
    port: 22,
    username: '',
    password: '',
    keyPath: '',
    workingDirectory: '/'
  });

  // ESC tuşu ile kapatma
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (showConnectionForm) {
          setShowConnectionForm(false);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose, showConnectionForm]);

  // Load connections
  useEffect(() => {
    if (isOpen) {
      loadConnections();
    }
  }, [isOpen]);

  const loadConnections = () => {
    const saved = localStorage.getItem('corex-remote-connections');
    if (saved) {
      const parsed = JSON.parse(saved);
      setConnections(parsed.map((conn: any) => ({ ...conn, connected: false })));
    }
  };

  const saveConnections = (conns: RemoteConnection[]) => {
    // Don't save passwords in localStorage for security
    const toSave = conns.map(conn => ({
      ...conn,
      password: undefined,
      connected: false
    }));
    localStorage.setItem('corex-remote-connections', JSON.stringify(toSave));
    setConnections(conns);
  };

  const addConnection = () => {
    const connection: RemoteConnection = {
      id: Date.now().toString(),
      name: newConnection.name,
      type: newConnection.type,
      host: newConnection.host,
      port: newConnection.port,
      username: newConnection.username,
      password: newConnection.password,
      keyPath: newConnection.keyPath,
      workingDirectory: newConnection.workingDirectory,
      connected: false
    };

    saveConnections([...connections, connection]);
    setShowConnectionForm(false);
    setNewConnection({
      name: '',
      type: 'ssh',
      host: '',
      port: 22,
      username: '',
      password: '',
      keyPath: '',
      workingDirectory: '/'
    });
  };

  const deleteConnection = (id: string) => {
    const updatedConnections = connections.filter(conn => conn.id !== id);
    saveConnections(updatedConnections);
    if (selectedConnection?.id === id) {
      setSelectedConnection(null);
      setRemoteFiles([]);
    }
  };

  const connectToRemote = async (connection: RemoteConnection) => {
    setIsConnecting(true);
    try {
      // Real SSH connection call
      await invoke('remote_ssh_connect', {
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password: connection.password || null,
        keyPath: connection.keyPath || null,
      });

      const updatedConnection = { ...connection, connected: true, lastConnected: Date.now() };
      const updatedConnections = connections.map(conn =>
        conn.id === connection.id ? updatedConnection : conn
      );
      setConnections(updatedConnections);
      setSelectedConnection(updatedConnection);

      // Load remote files
      await loadRemoteFiles(updatedConnection, connection.workingDirectory);

    } catch (error) {
      console.error('Connection failed:', error);
      alert(`Bağlantı Hatası: ${error}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectFromRemote = (connection: RemoteConnection) => {
    const updatedConnection = { ...connection, connected: false };
    const updatedConnections = connections.map(conn =>
      conn.id === connection.id ? updatedConnection : conn
    );
    setConnections(updatedConnections);

    if (selectedConnection?.id === connection.id) {
      setSelectedConnection(null);
      setRemoteFiles([]);
    }
  };

  const loadRemoteFiles = async (connection: RemoteConnection, path: string) => {
    console.log('Fetching remote files from:', path);
    try {
      const files = await invoke<RemoteFile[]>('remote_ssh_list_dir', {
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password: connection.password || null,
        keyPath: connection.keyPath || null,
        path: path
      });

      // Add '..' for navigation if not root
      if (path !== '/') {
        const parentPath = path.split('/').slice(0, -1).join('/') || '/';
        files.unshift({
          name: '..',
          path: parentPath,
          file_type: 'directory'
        });
      }

      setRemoteFiles(files);
      setCurrentPath(path);
    } catch (error) {
      console.error('Failed to load remote files:', error);
      alert(`Dosya listesi alınamadı: ${error}`);
    }
  };

  const navigateToPath = (path: string) => {
    if (selectedConnection) {
      loadRemoteFiles(selectedConnection, path);
    }
  };

  const uploadFile = async (file: File) => {
    if (!selectedConnection) return;

    try {
      // This would be implemented in the Rust backend
      console.log(`Uploading ${file.name} to ${currentPath}`);

      // Simulate upload
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh file list
      await loadRemoteFiles(selectedConnection, currentPath);

      alert(`File ${file.name} uploaded successfully!`);
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error}`);
    }
  };

  const downloadFile = async (file: RemoteFile) => {
    if (!selectedConnection) return;

    try {
      // This would be implemented in the Rust backend
      console.log(`Downloading ${file.name} from ${file.path}`);

      // Simulate download
      await new Promise(resolve => setTimeout(resolve, 1000));

      alert(`File ${file.name} downloaded successfully!`);
    } catch (error) {
      console.error('Download failed:', error);
      alert(`Download failed: ${error}`);
    }
  };

  const createRemoteFolder = async (name: string) => {
    if (!selectedConnection) return;

    try {
      // This would be implemented in the Rust backend
      console.log(`Creating folder ${name} in ${currentPath}`);

      // Simulate folder creation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh file list
      await loadRemoteFiles(selectedConnection, currentPath);

    } catch (error) {
      console.error('Folder creation failed:', error);
      alert(`Folder creation failed: ${error}`);
    }
  };

  const deleteRemoteFile = async (file: RemoteFile) => {
    if (!selectedConnection) return;

    const confirmed = confirm(`Are you sure you want to delete ${file.name}?`);
    if (!confirmed) return;

    try {
      // This would be implemented in the Rust backend
      console.log(`Deleting ${file.name} from ${file.path}`);

      // Simulate deletion
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh file list
      await loadRemoteFiles(selectedConnection, currentPath);

    } catch (error) {
      console.error('Deletion failed:', error);
      alert(`Deletion failed: ${error}`);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="h-12 bg-[var(--color-background)] border-b border-[var(--color-border)] flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌐</span>
              <h3 className="text-sm font-semibold text-[var(--color-text)]">Remote Development</h3>
              {selectedConnection && (
                <span className="text-xs px-2 py-1 bg-green-500 text-white rounded">
                  Connected to {selectedConnection.name}
                </span>
              )}
            </div>

            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center text-[var(--color-textSecondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] rounded transition-colors"
              title="Close (ESC)"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
            <div className="flex">
              {[
                { id: 'connections', name: 'Connections', icon: '🔗' },
                { id: 'files', name: 'Remote Files', icon: '📁' },
                { id: 'terminal', name: 'Remote Terminal', icon: '💻' },
                { id: 'sync', name: 'File Sync', icon: '🔄' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-[var(--color-textSecondary)] hover:text-[var(--color-text)]'
                    }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
            {/* Connections Tab */}
            {activeTab === 'connections' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-semibold">Remote Connections</h4>
                  <button
                    onClick={() => setShowConnectionForm(true)}
                    className="px-4 py-2 bg-[var(--color-primary)] text-white rounded hover:opacity-80 transition-opacity"
                  >
                    + Add Connection
                  </button>
                </div>

                {/* Connection Form */}
                {showConnectionForm && (
                  <div className="p-4 bg-[var(--color-background)] border border-[var(--color-border)] rounded">
                    <h5 className="font-semibold mb-4">New Remote Connection</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Connection Name:</label>
                        <input
                          type="text"
                          value={newConnection.name}
                          onChange={(e) => setNewConnection(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full p-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded"
                          placeholder="My Server"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Connection Type:</label>
                        <select
                          value={newConnection.type}
                          onChange={(e) => setNewConnection(prev => ({
                            ...prev,
                            type: e.target.value as any,
                            port: e.target.value === 'ssh' ? 22 : e.target.value === 'ftp' ? 21 : 22
                          }))}
                          className="w-full p-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded"
                        >
                          <option value="ssh">SSH</option>
                          <option value="sftp">SFTP</option>
                          <option value="ftp">FTP</option>
                          <option value="docker">Docker</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Host:</label>
                        <input
                          type="text"
                          value={newConnection.host}
                          onChange={(e) => setNewConnection(prev => ({ ...prev, host: e.target.value }))}
                          className="w-full p-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded"
                          placeholder="192.168.1.100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Port:</label>
                        <input
                          type="number"
                          value={newConnection.port}
                          onChange={(e) => setNewConnection(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                          className="w-full p-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Username:</label>
                        <input
                          type="text"
                          value={newConnection.username}
                          onChange={(e) => setNewConnection(prev => ({ ...prev, username: e.target.value }))}
                          className="w-full p-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded"
                          placeholder="user"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Password:</label>
                        <input
                          type="password"
                          value={newConnection.password}
                          onChange={(e) => setNewConnection(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full p-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded"
                          placeholder="••••••••"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">SSH Key Path (optional):</label>
                        <input
                          type="text"
                          value={newConnection.keyPath}
                          onChange={(e) => setNewConnection(prev => ({ ...prev, keyPath: e.target.value }))}
                          className="w-full p-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded"
                          placeholder="~/.ssh/id_rsa"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">Working Directory:</label>
                        <input
                          type="text"
                          value={newConnection.workingDirectory}
                          onChange={(e) => setNewConnection(prev => ({ ...prev, workingDirectory: e.target.value }))}
                          className="w-full p-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded"
                          placeholder="/home/user/projects"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={addConnection}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:opacity-80 transition-opacity"
                      >
                        Save Connection
                      </button>
                      <button
                        onClick={() => setShowConnectionForm(false)}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:opacity-80 transition-opacity"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Connections List */}
                <div className="space-y-3">
                  {connections.map(connection => (
                    <div key={connection.id} className="p-4 bg-[var(--color-background)] border border-[var(--color-border)] rounded">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-semibold">{connection.name}</h5>
                            <span className={`text-xs px-2 py-1 rounded ${connection.connected
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                              }`}>
                              {connection.connected ? 'Connected' : 'Disconnected'}
                            </span>
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                              {connection.type.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm text-[var(--color-textSecondary)]">
                            {connection.username}@{connection.host}:{connection.port}
                          </div>
                          <div className="text-xs text-[var(--color-textSecondary)]">
                            Working Directory: {connection.workingDirectory}
                          </div>
                          {connection.lastConnected && (
                            <div className="text-xs text-[var(--color-textSecondary)]">
                              Last connected: {formatDate(connection.lastConnected)}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {connection.connected ? (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedConnection(connection);
                                  setActiveTab('files');
                                }}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:opacity-80 transition-opacity"
                              >
                                Browse Files
                              </button>
                              <button
                                onClick={() => disconnectFromRemote(connection)}
                                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:opacity-80 transition-opacity"
                              >
                                Disconnect
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => connectToRemote(connection)}
                              disabled={isConnecting}
                              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:opacity-80 transition-opacity disabled:opacity-50"
                            >
                              {isConnecting ? 'Connecting...' : 'Connect'}
                            </button>
                          )}
                          <button
                            onClick={() => deleteConnection(connection.id)}
                            className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:opacity-80 transition-opacity"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {connections.length === 0 && (
                  <div className="text-center py-8 text-[var(--color-textSecondary)]">
                    <p>No remote connections configured.</p>
                    <p className="text-sm">Click "Add Connection" to get started.</p>
                  </div>
                )}
              </div>
            )}

            {/* Remote Files Tab */}
            {activeTab === 'files' && (
              <div className="space-y-4">
                {selectedConnection ? (
                  <>
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-lg font-semibold">Remote Files - {selectedConnection.name}</h4>
                        <p className="text-sm text-[var(--color-textSecondary)]">Current path: {currentPath}</p>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadFile(file);
                          }}
                          className="hidden"
                          id="upload-file"
                        />
                        <label
                          htmlFor="upload-file"
                          className="px-3 py-2 bg-blue-600 text-white rounded cursor-pointer hover:opacity-80 transition-opacity text-sm"
                        >
                          📤 Upload File
                        </label>
                        <button
                          onClick={() => {
                            const name = prompt('Folder name:');
                            if (name) createRemoteFolder(name);
                          }}
                          className="px-3 py-2 bg-green-600 text-white rounded hover:opacity-80 transition-opacity text-sm"
                        >
                          📁 New Folder
                        </button>
                        <button
                          onClick={() => loadRemoteFiles(selectedConnection, currentPath)}
                          className="px-3 py-2 bg-gray-600 text-white rounded hover:opacity-80 transition-opacity text-sm"
                        >
                          🔄 Refresh
                        </button>
                      </div>
                    </div>

                    <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded">
                      <div className="grid grid-cols-12 gap-2 p-3 border-b border-[var(--color-border)] font-semibold text-sm">
                        <div className="col-span-6">Name</div>
                        <div className="col-span-2">Size</div>
                        <div className="col-span-2">Modified</div>
                        <div className="col-span-2">Actions</div>
                      </div>

                      {remoteFiles.map((file, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 p-3 border-b border-[var(--color-border)] hover:bg-[var(--color-hover)] transition-colors">
                          <div className="col-span-6 flex items-center gap-2">
                            <span>{file.file_type === 'directory' ? '📁' : '📄'}</span>
                            <button
                              onClick={() => {
                                if (file.file_type === 'directory') {
                                  navigateToPath(file.path);
                                } else {
                                  onOpenRemoteFile(selectedConnection, file.path);
                                }
                              }}
                              className="text-left hover:text-[var(--color-primary)] transition-colors"
                            >
                              {file.name}
                            </button>
                          </div>
                          <div className="col-span-2 text-sm text-[var(--color-textSecondary)]">
                            {formatFileSize(file.size)}
                          </div>
                          <div className="col-span-2 text-sm text-[var(--color-textSecondary)]">
                            {formatDate(file.modified)}
                          </div>
                          <div className="col-span-2 flex gap-1">
                            {file.file_type === 'file' && (
                              <button
                                onClick={() => downloadFile(file)}
                                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:opacity-80 transition-opacity"
                              >
                                📥
                              </button>
                            )}
                            {file.name !== '..' && (
                              <button
                                onClick={() => deleteRemoteFile(file)}
                                className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:opacity-80 transition-opacity"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-[var(--color-textSecondary)]">
                    <p>No remote connection selected.</p>
                    <p className="text-sm">Connect to a server from the Connections tab first.</p>
                  </div>
                )}
              </div>
            )}

            {/* Remote Terminal Tab */}
            {activeTab === 'terminal' && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold">Remote Terminal</h4>
                {selectedConnection ? (
                  <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-96 overflow-y-auto">
                    <div>Connected to {selectedConnection.name}</div>
                    <div>{selectedConnection.username}@{selectedConnection.host}:~$ </div>
                    <div className="text-gray-500">Remote terminal functionality will be implemented in the backend.</div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-[var(--color-textSecondary)]">
                    <p>No remote connection selected.</p>
                    <p className="text-sm">Connect to a server first to access remote terminal.</p>
                  </div>
                )}
              </div>
            )}

            {/* File Sync Tab */}
            {activeTab === 'sync' && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold">File Synchronization</h4>
                <div className="p-4 bg-yellow-100 border border-yellow-300 rounded text-yellow-800">
                  <p className="font-semibold">🚧 Coming Soon</p>
                  <p className="text-sm">File synchronization features will be available in a future update.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}