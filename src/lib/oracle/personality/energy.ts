// FILE: src/lib/oracle/personality/energy.ts
// User Energy Detection
//
// Analyzes user messages to detect emotional energy.
// Used by identity/manager.ts to update oracle_identity.user_energy
// Used by prompt/builder.ts to adjust Oracle's tone in real-time

// =============================================================================
// ENERGY KEYWORDS
// =============================================================================

const EXCITED_SIGNALS = [
  '!', 'awesome', 'amazing', 'love', 'incredible', 'perfect', 'wow',
  'fantastic', 'brilliant', 'excellent', 'hell yeah', 'lets go',
  'nice find', 'jackpot', 'score', 'nailed it', 'killed it',
];

const FRUSTRATED_SIGNALS = [
  'help', 'confused', 'wrong', 'broken', 'stuck', 'annoying',
  'doesn\'t work', 'not working', 'can\'t figure', 'frustrating',
  'messed up', 'why won\'t', 'keeps failing', 'ugh', 'seriously',
];

const FOCUSED_SIGNALS = [
  // Short questions indicate focused energy
  // Detected by: message has '?' and is under 40 chars
];

// =============================================================================
// DETECT
// =============================================================================

export type UserEnergy = 'excited' | 'frustrated' | 'focused' | 'neutral';

/**
 * Detect user's emotional energy from their message.
 * Returns one of: excited, frustrated, focused, neutral
 */
export function detectUserEnergy(message: string): UserEnergy {
  const msgLower = message.toLowerCase();

  // Check excited signals
  for (const signal of EXCITED_SIGNALS) {
    if (msgLower.includes(signal)) return 'excited';
  }

  // Check frustrated signals
  for (const signal of FRUSTRATED_SIGNALS) {
    if (msgLower.includes(signal)) return 'frustrated';
  }

  // Short question = focused
  if (msgLower.includes('?') && msgLower.length < 40) {
    return 'focused';
  }

  return 'neutral';
}