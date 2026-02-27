import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { invoke } from '@tauri-apps/api/core';

interface Container {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports?: string[];
  created?: number;
  size?: string;
}

interface Image {
  id: string;
  repository: string;
  tag: string;
  size: number;
  created?: number;
}

interface DockerCompose {
  id: string;
  name: string;
  services: string[];
  status: 'running' | 'stopped';
  file: string;
}

export default function DockerIntegration() {
  const { t } = useLanguage();
  const [containers, setContainers] = useState<Container[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [composeProjects, setComposeProjects] = useState<DockerCompose[]>([]);
  const [activeTab, setActiveTab] = useState<'containers' | 'images' | 'compose'>('containers');
  const [isDockerRunning, setIsDockerRunning] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [logs] = useState<Record<string, string[]>>({}); // Placeholder for now

  useEffect(() => {
    loadDockerData();
  }, []);

  const loadDockerData = async () => {
    try {
      const containerList = await invoke<Container[]>('docker_list_containers');
      setContainers(containerList);

      const imageList = await invoke<Image[]>('docker_list_images');
      setImages(imageList);

      setIsDockerRunning(true);

      // Keep mock compose for now as it's not implemented in backend
      setComposeProjects([
        {
          id: 'comp_1',
          name: 'web-app',
          services: ['web', 'db', 'redis'],
          status: 'running',
          file: 'docker-compose.yml'
        }
      ]);

    } catch (error) {
      console.error('Docker data load failed:', error);
      setIsDockerRunning(false);
    }
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('up')) return 'text-green-500';
    if (s.includes('exited')) return 'text-red-500';
    if (s.includes('paused')) return 'text-yellow-500';
    return 'text-gray-500';
  };

  const getStatusIcon = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('up')) return '🟢';
    if (s.includes('exited')) return '🔴';
    if (s.includes('paused')) return '🟡';
    return '⚪';
  };

  const runAction = async (id: string, action: string) => {
    try {
      await invoke('docker_container_action', { id, action });
      await loadDockerData();
    } catch (error) {
      console.error(`Docker action ${action} failed:`, error);
      alert(`Docker Hatası: ${error}`);
    }
  };

  const startContainer = (id: string) => runAction(id, 'start');
  const stopContainer = (id: string) => runAction(id, 'stop');
  const restartContainer = (id: string) => runAction(id, 'restart');
  const removeContainer = (id: string) => runAction(id, 'remove');

  const removeImage = async (id: string) => {
    try {
      await invoke('docker_remove_image', { id });
      await loadDockerData();
    } catch (error) {
      console.error('Failed to remove image:', error);
      alert(`Image Hatası: ${error}`);
    }
  };

  const pullImage = (repository: string, tag: string = 'latest') => {
    const newImage: Image = {
      id: `img_${Date.now()}`,
      repository,
      tag,
      size: 0,
      created: Date.now()
    };
    setImages(prev => [...prev, newImage]);
  };

  const ContainerActions = ({ container }: { container: Container }) => (
    <div className="flex gap-1">
      {container.status === 'stopped' ? (
        <button
          onClick={() => startContainer(container.id)}
          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:opacity-80"
          title="Start"
        >
          ▶️
        </button>
      ) : (
        <button
          onClick={() => stopContainer(container.id)}
          className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:opacity-80"
          title="Stop"
        >
          ⏹️
        </button>
      )}
      <button
        onClick={() => restartContainer(container.id)}
        className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:opacity-80"
        title="Restart"
      >
        🔄
      </button>
      <button
        onClick={() => setSelectedContainer(container.id)}
        className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:opacity-80"
        title="Logs"
      >
        📋
      </button>
      <button
        onClick={() => removeContainer(container.id)}
        className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:opacity-80"
        title="Remove"
      >
        🗑️
      </button>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface)]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">🐳 {t('activity.docker')}</h2>

        {/* Docker Status */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-2 h-2 rounded-full ${isDockerRunning ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className="text-sm">
            Docker {isDockerRunning ? 'Running' : 'Not Running'}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {(['containers', 'images', 'compose'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-sm rounded transition-colors capitalize ${activeTab === tab
                ? 'bg-[var(--color-primary)] text-white'
                : 'hover:bg-[var(--color-hover)]'
                }`}
            >
              {tab === 'containers' ? t('docker.containers') :
                tab === 'images' ? t('docker.images') :
                  t('docker.compose')}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'containers' && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{t('docker.containers')} ({containers.length})</h3>
              <button className="px-3 py-1 bg-[var(--color-primary)] text-white rounded text-sm hover:opacity-80">
                ➕ {t('docker.run')} Container
              </button>
            </div>

            <div className="space-y-2">
              {containers.map(container => (
                <div key={container.id} className="p-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span>{getStatusIcon(container.status)}</span>
                      <div>
                        <h4 className="font-medium">{container.name}</h4>
                        <p className="text-sm text-[var(--color-textSecondary)]">{container.image}</p>
                      </div>
                    </div>
                    <ContainerActions container={container} />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm text-[var(--color-textSecondary)]">
                    <div>
                      <span className="font-medium">Status:</span>
                      <span className={getStatusColor(container.status)}> {container.status}</span>
                    </div>
                    <div>
                      <span className="font-medium">Size:</span> {container.size}
                    </div>
                    <div>
                      <span className="font-medium">Ports:</span> {container.ports?.join(', ') || 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Created:</span> {container.created ? new Date(container.created).toLocaleDateString() : 'Unknown'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'images' && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Images ({images.length})</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="nginx:latest"
                  className="px-3 py-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded text-sm"
                />
                <button
                  onClick={() => pullImage('nginx', 'latest')}
                  className="px-3 py-1 bg-[var(--color-primary)] text-white rounded text-sm hover:opacity-80"
                >
                  📥 Pull
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {images.map(image => (
                <div key={image.id} className="p-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{image.repository}:{image.tag}</h4>
                      <div className="flex gap-4 text-sm text-[var(--color-textSecondary)] mt-1">
                        <span>Size: {(image.size / 1024 / 1024).toFixed(1)} MB</span>
                        <span>Created: {image.created ? new Date(image.created).toLocaleDateString() : 'Unknown'}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {/* Run container from image */ }}
                        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:opacity-80"
                        title="Run"
                      >
                        ▶️
                      </button>
                      <button
                        onClick={() => removeImage(image.id)}
                        className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:opacity-80"
                        title="Remove"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'compose' && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Docker Compose ({composeProjects.length})</h3>
              <button className="px-3 py-1 bg-[var(--color-primary)] text-white rounded text-sm hover:opacity-80">
                ➕ Add Project
              </button>
            </div>

            <div className="space-y-2">
              {composeProjects.map(project => (
                <div key={project.id} className="p-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span>{getStatusIcon(project.status)}</span>
                      <div>
                        <h4 className="font-medium">{project.name}</h4>
                        <p className="text-sm text-[var(--color-textSecondary)]">{project.file}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {project.status === 'stopped' ? (
                        <button
                          onClick={() => invoke('docker_compose_action', { path: project.file, action: 'up' }).then(loadDockerData)}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:opacity-80"
                        >
                          ▶️ Up
                        </button>
                      ) : (
                        <button
                          onClick={() => invoke('docker_compose_action', { path: project.file, action: 'down' }).then(loadDockerData)}
                          className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:opacity-80"
                        >
                          ⏹️ Down
                        </button>
                      )}
                      <button
                        onClick={() => invoke('docker_compose_action', { path: project.file, action: 'restart' }).then(loadDockerData)}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:opacity-80"
                      >
                        🔄 Restart
                      </button>
                    </div>
                  </div>

                  <div className="text-sm text-[var(--color-textSecondary)]">
                    <span className="font-medium">Services:</span> {project.services.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Logs Modal */}
      {selectedContainer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg w-[600px] h-[400px] flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <h3 className="font-semibold">
                Container Logs - {containers.find(c => c.id === selectedContainer)?.name}
              </h3>
              <button
                onClick={() => setSelectedContainer(null)}
                className="text-[var(--color-textSecondary)] hover:text-[var(--color-text)]"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto bg-black text-green-400 font-mono text-sm">
              {logs[selectedContainer]?.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              )) || <div>No logs available</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}