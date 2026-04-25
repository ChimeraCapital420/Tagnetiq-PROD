// FILE: src/components/vault/components/index.ts
// v2.0: Added new VaultPage modular components alongside existing modal screens

// ── Existing VaultExportModal screens (unchanged) ─────────────────────────────
export { SelectionScreen } from './SelectionScreen';
export { ExportPdfScreen } from './ExportPdfScreen';
export { MarkSoldScreen } from './MarkSoldScreen';
export { MarkIncidentScreen } from './MarkIncidentScreen';
export { DeleteScreen } from './DeleteScreen';

// ── New VaultPage modular components (v2.0 addition) ─────────────────────────
export { VaultSkeletonLoader } from './VaultSkeletonLoader';
export { VaultCard } from './VaultCard';
export { VaultSecurityControls } from './VaultSecurityControls';
export { VaultSecurityDialogs } from './VaultSecurityDialogs';
export { CreateVaultDialog } from './CreateVaultDialog';
export { VaultLobby } from './VaultLobby';
export { VaultDetailView } from './VaultDetailView';