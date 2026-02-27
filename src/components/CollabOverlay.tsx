import React, { useState, useEffect } from 'react';
import { collabService, UserPresence } from '../services/collaborationService';

const CollabOverlay: React.FC = () => {
    const [users, setUsers] = useState<UserPresence[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const unsubUsers = collabService.onUsersUpdate(setUsers);
        const unsubStatus = collabService.onStatusChange(setIsConnected);
        return () => {
            unsubUsers();
            unsubStatus();
        };
    }, []);

    if (!isConnected) return null;

    return (
        <div className="fixed top-4 right-20 z-50 flex items-center gap-2 pointer-events-none">
            <div className="flex -space-x-2 mr-2">
                {users.map((user) => (
                    <div
                        key={user.id}
                        className="w-8 h-8 rounded-full border-2 border-[#1e1e1e] flex items-center justify-center text-[10px] font-bold text-white shadow-lg pointer-events-auto cursor-help transition-all transform hover:scale-110 relative"
                        style={{ backgroundColor: user.color }}
                        title={`${user.name} (${user.isActive ? 'Active' : 'Away'})`}
                    >
                        {user.name.charAt(0).toUpperCase()}
                        {user.isActive && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#1e1e1e]" />
                        )}
                    </div>
                ))}
            </div>

            <div className="bg-indigo-600/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-xl border border-white/10 flex items-center gap-2 pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-white tracking-widest uppercase">Live Collab</span>
                <div className="h-3 w-[1px] bg-white/20 mx-1" />
                <span className="text-[10px] text-white/80 font-mono">{collabService.getSessionId()?.substring(0, 8)}</span>
            </div>
        </div>
    );
};

export default CollabOverlay;
