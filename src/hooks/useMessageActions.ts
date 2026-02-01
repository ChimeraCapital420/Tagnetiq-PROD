// FILE: src/hooks/useMessageActions.ts

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface UseMessageActionsOptions {
  onMessageDeleted?: (messageId: string) => void;
}

export function useMessageActions(options: UseMessageActionsOptions = {}) {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openActions = useCallback((messageId: string) => {
    setSelectedMessageId(messageId);
    setError(null);
  }, []);

  const closeActions = useCallback(() => {
    setSelectedMessageId(null);
    setError(null);
  }, []);

  const deleteMessage = useCallback(async (
    messageId: string, 
    deleteForEveryone: boolean
  ) => {
    setIsDeleting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/arena/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ deleteForEveryone }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete message');
      }

      options.onMessageDeleted?.(messageId);
      closeActions();
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      setError(message);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  }, [options, closeActions]);

  return {
    selectedMessageId,
    isDeleting,
    error,
    openActions,
    closeActions,
    deleteMessage,
  };
}