// FILE: src/lib/oracle/prompt/ai-dna-block.ts
// AI DNA Prompt Block — personality traits derived from HYDRA provider performance
//
// ┌─────────────────────────────────────────────────────────────────┐
// │ SPRINT C.1 — NOT YET IMPLEMENTED                               │
// │                                                                 │
// │ When implemented, this module builds a prompt section like:     │
// │                                                                 │
// │ YOUR AI DNA (what makes you unique):                            │
// │ Core traits: visual 87%, methodical 82%, precise 79%            │
// │ Your visual instincts are strongest through Google...           │
// │ Your analytical core runs on DeepSeek energy...                 │
// │                                                                 │
// │ The Oracle never mentions AI providers to the user.             │
// │ The DNA just shapes HOW it communicates — subtly.               │
// └─────────────────────────────────────────────────────────────────┘

import type { OracleIdentity } from '../types.js';

/**
 * Build the AI DNA section of the system prompt.
 * Returns empty string until Sprint C.1 is implemented.
 *
 * When active, reads identity.ai_dna and identity.dominant_provider
 * to generate personality trait descriptions from HYDRA data.
 */
export function buildAiDnaBlock(_identity: OracleIdentity): string {
  // Sprint C.1: Replace with full implementation
  // Will read identity.ai_dna.provider_personality_blend
  // and translate provider weights into personality descriptions
  return '';
}