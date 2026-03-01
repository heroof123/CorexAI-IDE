/**
 * Collaboration Panel Component
 * Real-time user presence, cursor tracking, live editing indicators
 * 
 * Features:
 * - Active user list with presence indicators
 * - Live cursor position tracking
 * - User activity status
 * - Connection status display
 * - Latency indicators
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface RemoteUser {
  id: string;
  name: string;
  color: string;
  cursor?: {
    line: number;
    column: number;
    file: string;
  };
  isActive: boolean;
  lastSeen: number;
}

interface CollaborationPanelProps {
  isEnabled: boolean;
  currentUser?: RemoteUser;
  onToggle: () => void;
}

const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  isEnabled,
  currentUser,
  onToggle,
}) => {
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [latency, setLatency] = useState<number>(0);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPingRef = useRef<number>(0);

  // WebSocket connection setup
  useEffect(() => {
    if (!isEnabled) {
      disconnectWebSocket();
      return;
    }

    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
  }, [isEnabled]);

  const connectWebSocket = useCallback(() => {
    try {
      setConnectionStatus('connecting');

      // Connect to local WebSocket server
      const wsUrl = `ws://localhost:9001/collaborate`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('✅ WebSocket connected');
        setConnectionStatus('connected');

        // Send initial presence
        if (currentUser) {
          sendMessage({
            type: 'user_join',
            payload: {
              user: currentUser,
            },
          });
        }

        // Start heartbeat
        startPingInterval();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } catch (error) {
          console.error('❌ Failed to parse message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('error');
      };

      wsRef.current.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setConnectionStatus('idle');
        stopPingInterval();
      };
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      setConnectionStatus('error');
    }
  }, [currentUser]);

  const disconnectWebSocket = () => {
    stopPingInterval();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus('idle');
    setRemoteUsers([]);
  };

  const sendMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  const handleMessage = (message: any) => {
    const { type, payload } = message;

    switch (type) {
      case 'user_join':
        setRemoteUsers((prev) => {
          const exists = prev.find((u) => u.id === payload.user.id);
          if (exists) return prev;
          return [...prev, payload.user];
        });
        break;

      case 'user_leave':
        setRemoteUsers((prev) => prev.filter((u) => u.id !== payload.userId));
        break;

      case 'cursor_move':
        setRemoteUsers((prev) =>
          prev.map((u) =>
            u.id === payload.userId
              ? { ...u, cursor: payload.cursor, lastSeen: Date.now() }
              : u
          )
        );
        break;

      case 'users':
        setRemoteUsers(payload.users);
        break;

      case 'pong':
        const roundtrip = Date.now() - lastPingRef.current;
        setLatency(roundtrip);
        break;

      case 'error':
        console.error('❌ Server error:', payload.message);
        setConnectionStatus('error');
        break;

      default:
        console.debug('Unknown message type:', type);
    }
  };

  const startPingInterval = () => {
    stopPingInterval();
    pingIntervalRef.current = setInterval(() => {
      lastPingRef.current = Date.now();
      sendMessage({
        type: 'ping',
        payload: { timestamp: Date.now() },
      });
    }, 5000); // Every 5 seconds
  };

  const stopPingInterval = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  };

  const toggleUserDetails = (userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const getConnectionColor = (): string => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getLatencyColor = (): string => {
    if (latency < 50) return 'text-green-400';
    if (latency < 100) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatTime = (timestamp: number): string => {
    const ms = Date.now() - timestamp;
    if (ms < 1000) return 'now';
    if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
    return `${Math.floor(ms / 60000)}m ago`;
  };

  return (
    <div className="flex flex-col h-full bg-[#252526] border-l border-[#3e3e42]">
      {/* Header */}
      <div className="p-3 border-b border-[#3e3e42] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-neutral-200">
            Collaboration
          </h3>
          <button
            onClick={onToggle}
            className={`w-2.5 h-2.5 rounded-full transition-all ${getConnectionColor()}`}
            title={`Status: ${connectionStatus}`}
          />
        </div>
        <span
          className={`text-xs px-2 py-1 rounded ${
            isEnabled
              ? 'bg-green-500/20 text-green-400'
              : 'bg-gray-500/20 text-gray-400'
          }`}
        >
          {isEnabled ? 'On' : 'Off'}
        </span>
      </div>

      {/* Connection Status */}
      <div className="px-3 py-2 bg-[#1e1e1e] border-b border-[#3e3e42]">
        <div className="flex justify-between text-xs text-neutral-400 mb-1">
          <span>Status: {connectionStatus}</span>
          <span className={getLatencyColor()}>{latency}ms</span>
        </div>
        <div className="w-full h-1 bg-[#3e3e42] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              connectionStatus === 'connected'
                ? 'bg-green-500'
                : connectionStatus === 'error'
                ? 'bg-red-500'
                : 'bg-yellow-500'
            }`}
            style={{
              width: connectionStatus === 'connected' ? '100%' : '50%',
            }}
          />
        </div>
      </div>

      {/* Users List */}
      <div className="flex-1 overflow-y-auto">
        {remoteUsers.length === 0 ? (
          <div className="p-4 text-center text-xs text-neutral-500">
            {isEnabled ? 'No active users' : 'Collaboration disabled'}
          </div>
        ) : (
          <div className="divide-y divide-[#3e3e42]">
            {remoteUsers.map((user) => (
              <div
                key={user.id}
                className="p-3 hover:bg-[#2d2d30] cursor-pointer transition-colors"
                onClick={() => toggleUserDetails(user.id)}
              >
                {/* User Header */}
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full border-2 border-[#3e3e42]"
                    style={{ backgroundColor: user.color }}
                  />
                  <span className="flex-1 text-sm font-medium text-neutral-200">
                    {user.name}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      user.isActive ? 'bg-green-500' : 'bg-gray-500'
                    }`}
                    title={user.isActive ? 'Active' : 'Inactive'}
                  />
                </div>

                {/* Last Seen */}
                <div className="text-xs text-neutral-500 ml-5">
                  {formatTime(user.lastSeen)}
                </div>

                {/* Expanded Details */}
                {expandedUsers.has(user.id) && user.cursor && (
                  <div className="mt-2 p-2 bg-[#1e1e1e] rounded border border-[#3e3e42] text-xs text-neutral-400 ml-5">
                    <div className="mb-1">
                      <span className="text-neutral-500">File:</span>{' '}
                      <span className="text-blue-400">{user.cursor.file}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">Cursor:</span> Line{' '}
                      <span className="text-yellow-400">{user.cursor.line + 1}</span>
                      , Column{' '}
                      <span className="text-yellow-400">{user.cursor.column + 1}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {isEnabled && (
        <div className="p-3 border-t border-[#3e3e42] bg-[#1e1e1e] text-xs text-neutral-500 space-y-1">
          <div className="flex justify-between">
            <span>Users Online:</span>
            <span className="text-neutral-300 font-semibold">{remoteUsers.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Active:</span>
            <span className="text-green-400 font-semibold">
              {remoteUsers.filter((u) => u.isActive).length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollaborationPanel;
