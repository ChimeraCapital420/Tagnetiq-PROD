// FILE: src/lib/oracle/prompt/index.ts
// Sprint M: Added buildRecallPromptBlock export
export { buildSystemPrompt } from './builder.js';
export { buildIdentityBlock, buildPersonalityBlock } from './identity-block.js';
export { buildAiDnaBlock } from './ai-dna-block.js';
export { buildScanContext } from './scan-context.js';
export { buildVaultContext, buildProfileContext } from './vault-context.js';
export { buildArgosBlock, fetchArgosContext, type ArgosContext } from './argos-context.js';