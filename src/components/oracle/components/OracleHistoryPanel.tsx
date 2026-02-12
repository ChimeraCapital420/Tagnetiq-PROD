// FILE: src/components/oracle/components/OracleHistoryPanel.tsx
// Slide-down panel showing past conversations

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConversationSummary } from '../types';

interface Props {
  visible: boolean;
  conversations: ConversationSummary[];
  activeId: string | null;
  isLoading: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function OracleHistoryPanel({
  visible, conversations, activeId, isLoading,
  onClose, onSelect, onDelete,
}: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="flex-none border-b border-border/50 bg-accent/20 max-h-[40vh] overflow-y-auto"
        >
          <div className="px-4 py-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Past conversations</span>
              <button onClick={onClose} className="p-1 rounded hover:bg-accent/50">
                <X className="w-3 h-3" />
              </button>
            </div>

            {isLoading ? (
              <div className="py-4 text-center">
                <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No past conversations yet</p>
            ) : (
              <div className="space-y-1">
                {conversations.map(convo => (
                  <button
                    key={convo.id}
                    onClick={() => onSelect(convo.id)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-colors',
                      convo.id === activeId ? 'bg-primary/10' : 'hover:bg-accent/50'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{convo.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(convo.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(convo.id); }}
                      className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}