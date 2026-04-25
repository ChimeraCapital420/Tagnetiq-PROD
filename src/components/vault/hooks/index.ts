// FILE: src/components/vault/hooks/index.ts
// v2.0: Added new VaultPage hooks alongside existing modal hooks

// ── Existing VaultExportModal hooks (unchanged) ───────────────────────────────
export { useVaultSelection } from './useVaultSelection';
export { useVaultActions } from './useVaultActions';

// ── New VaultPage hooks (v2.0 addition) ──────────────────────────────────────
export { useVaultSecurity } from './useVaultSecurity';
export { useVaultData } from './useVaultData';