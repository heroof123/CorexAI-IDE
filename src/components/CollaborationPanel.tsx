import React, { useState, useEffect } from 'react';
import { collabService, UserPresence } from '../services/collaborationService';

interface CollaborationPanelProps {
}

const CollaborationPanel: React.FC<CollaborationPanelProps> = () => {
  const [remoteUsers, setRemoteUsers] = useState<UserPresence[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    const unsubUsers = collabService.onUsersUpdate(setRemoteUsers);
    const unsubStatus = collabService.onStatusChange(setIsConnected);

    return () => {
      unsubUsers();
      unsubStatus();
    };
  }, []);

  const handleCreateSession = async () => {
    try {
      const id = await collabService.createSession();
      setCurrentSessionId(id);
      await collabService.connect(id);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleJoinSession = async () => {
    if (!joinId) return;
    try {
      await collabService.connect(joinId);
      setCurrentSessionId(joinId);
    } catch (error) {
      console.error('Failed to join session:', error);
    }
  };

  const getStatusColor = (): string => {
    return isConnected ? 'bg-green-500' : 'bg-gray-500';
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)] border-l border-[var(--color-border)]">
      {/* Header */}
      <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">
            Collaboration
          </h3>
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        </div>
        {isConnected && (
          <button
            onClick={() => collabService.disconnect()}
            className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
          >
            Disconnect
          </button>
        )}
      </div>

      {/* Session Controls */}
      {!isConnected ? (
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Create Session</h4>
            <button
              onClick={handleCreateSession}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-500/20"
            >
              🚀 Share My Project
            </button>
          </div>

          <div className="relative py-4 flex items-center">
            <div className="flex-grow border-t border-[var(--color-border)]"></div>
            <span className="flex-shrink mx-4 text-xs text-neutral-600">OR</span>
            <div className="flex-grow border-t border-[var(--color-border)]"></div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Join Session</h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder="Session ID..."
                className="flex-1 bg-black/20 border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
              />
              <button
                onClick={handleJoinSession}
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg text-xs font-bold transition-all"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-indigo-500/10 border-b border-[var(--color-border)]">
          <div className="text-[10px] text-neutral-500 mb-1 uppercase tracking-tight">Active Session ID</div>
          <div className="flex items-center justify-between gap-2 overflow-hidden">
            <code className="text-[11px] font-mono text-indigo-400 bg-black/40 px-2 py-1 rounded border border-indigo-500/20 truncate">
              {currentSessionId}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(currentSessionId || '');
              }}
              className="p-1 px-2 hover:bg-white/5 rounded text-[10px] text-neutral-400"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <h4 className="px-2 pb-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Active Users ({remoteUsers.length})</h4>
          {remoteUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-600 italic">
              No other developers connected yet.
            </div>
          ) : (
            <div className="space-y-1">
              {remoteUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: user.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-neutral-200 truncate">
                      {user.name}
                    </div>
                    {user.cursor && (
                      <div className="text-[10px] text-neutral-500 truncate">
                        📍 {user.cursor.file.split('/').pop()}:{user.cursor.line + 1}
                      </div>
                    )}
                  </div>
                  {user.isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Stats */}
      {isConnected && (
        <div className="p-4 border-t border-[var(--color-border)] bg-black/10">
          <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/5">
            <div className="text-[10px] text-indigo-400 font-bold mb-1">REAL-TIME SYNC</div>
            <div className="text-[11px] text-neutral-400 leading-relaxed">
              Cursors and edits are being synchronized automatically across all participants.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollaborationPanel;
