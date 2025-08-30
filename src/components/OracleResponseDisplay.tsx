// FILE: src/components/OracleResponseDisplay.tsx
// STATUS: NEW - This component displays conversational advice from the Oracle.

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppContext } from '@/contexts/AppContext';
import { Sparkles } from 'lucide-react';

const OracleResponseDisplay: React.FC = () => {
  const { oracleResponse } = useAppContext();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (oracleResponse && oracleResponse.text) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 12000); // Display for 12 seconds

      return () => clearTimeout(timer);
    }
  }, [oracleResponse]);

  return (
    <div className="fixed bottom-6 left-6 z-[100] w-full max-w-md pointer-events-none">
      <AnimatePresence>
        {isVisible && oracleResponse && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20, transition: { duration: 0.5 } }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="p-4 rounded-lg shadow-2xl bg-background/80 backdrop-blur-md border border-primary/20"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Oracle</h4>
                <p className="text-sm text-muted-foreground">{oracleResponse.text}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OracleResponseDisplay;
