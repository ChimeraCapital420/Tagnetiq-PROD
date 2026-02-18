// FILE: src/lib/oracle/client/device-detector.ts
// ═══════════════════════════════════════════════════════════════════════
// Client-Side Device Detection (Liberation 2)
// ═══════════════════════════════════════════════════════════════════════
// Extracted from useOracleChat.ts monolith (Phase 1).
// Pure function — runs on device, sent to server for analytics
// and to optimize response length/format.
// ═══════════════════════════════════════════════════════════════════════

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * Detect the user's device type from viewport width.
 * Mobile-first breakpoints matching Tailwind defaults.
 *
 * Used by:
 *   - Server: adjusts response verbosity (shorter on mobile)
 *   - Analytics: tracks device distribution
 *   - Liberation 2: sent as client hint
 *
 * @returns Device type string
 */
export function getDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';

  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}