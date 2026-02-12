// FILE: src/components/oracle/components/ConversationBanner.tsx
// Red banner shown when conversation mode is active

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  active: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  onEnd: () => void;
}

export function ConversationBanner({ active, isListening, isSpeaking, onEnd }: Props) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="flex-none bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-400 font-medium">
              {isListening ? 'Listening...' : isSpeaking ? 'Oracle speaking...' : 'Waiting for you...'}
            </span>
          </div>
          <button onClick={onEnd} className="text-xs text-red-400 hover:text-red-300 font-medium">
            End
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}