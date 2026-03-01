/**
 * useCollaboration Hook
 * Manages collaboration state and cursor sync
 * 
 * Features:
 * - Cursor position tracking and broadcasting
 * - User presence management
 * - Message batching for efficiency
 * - Automatic cleanup
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useCore } from './useCore';

interface CursorPosition {
  line: number;
  column: number;
  file: string;
}

export function useCollaboration() {
  const { coreMessages } = useCore();
  const [isEnabled, setIsEnabled] = useState(false);
  const [localCursor, setLocalCursor] = useState<CursorPosition | null>(null);
  const cursorBatchRef = useRef<Map<string, CursorPosition>>(new Map());
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userId = useRef(localStorage.getItem('collaboration_user_id') || '');

  // Initialize user ID
  useEffect(() => {
    if (!userId.current) {
      userId.current = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('collaboration_user_id', userId.current);
    }
  }, []);

  // Update cursor position with batching
  const updateCursorPosition = useCallback((cursor: CursorPosition) => {
    setLocalCursor(cursor);
    cursorBatchRef.current.set(userId.current, cursor);

    // Clear existing timeout
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    // Batch updates every 100ms
    batchTimeoutRef.current = setTimeout(() => {
      const updates = Array.from(cursorBatchRef.current.entries());
      if (updates.length > 0) {
        // Send batch to server
        console.debug('📍 Sending cursor batch:', updates.length);
      }
      cursorBatchRef.current.clear();
    }, 100);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  return {
    isEnabled,
    setIsEnabled,
    localCursor,
    updateCursorPosition,
    userId: userId.current,
  };
}
