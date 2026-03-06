// FILE: src/components/oracle/hooks/useOraclePrefill.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Prefill Hook
// ═══════════════════════════════════════════════════════════════════════
//
// Reads the sessionStorage prefill written by FloatingOracleButton when
// the user speaks/types from any screen and hits Send.
//
// USAGE — add to your Oracle page component (wherever useOracleChat lives):
//
//   import { useOraclePrefill } from './hooks/useOraclePrefill';
//
//   // Inside the component:
//   useOraclePrefill(sendMessage);
//
// That's it. One line. Hook clears the sessionStorage key after reading
// so it never fires twice on re-mount or refresh.
//
// The hook waits 400ms after mount before sending — ensures Oracle chat
// is initialized and ready to receive a message.
// ═══════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';

const PREFILL_KEY = 'oracle_prefill';

/**
 * @param sendMessage - The sendMessage function from useOracleChat
 */
export function useOraclePrefill(sendMessage: (text: string) => void) {
  useEffect(() => {
    const prefill = sessionStorage.getItem(PREFILL_KEY);
    if (!prefill) return;

    // Clear immediately so refresh / remount doesn't re-fire
    sessionStorage.removeItem(PREFILL_KEY);

    // Small delay — let Oracle's initial greeting load first
    const timer = setTimeout(() => {
      sendMessage(prefill);
    }, 400);

    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Empty deps intentional — runs once on mount only
}