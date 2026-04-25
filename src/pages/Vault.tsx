// FILE: src/pages/Vault.tsx
// Thin orchestrator — wires hooks to components.
//
// v2.0: Refactored from 900-line monolith to modular architecture.
//   All security logic    → src/components/vault/hooks/useVaultSecurity.ts
//   All data fetching     → src/components/vault/hooks/useVaultData.ts
//   Lobby UI + scan intel → src/components/vault/components/VaultLobby.tsx
//   Item detail view      → src/components/vault/components/VaultDetailView.tsx
//   Security dialogs      → src/components/vault/components/VaultSecurityDialogs.tsx
//   Security dropdown     → src/components/vault/components/VaultSecurityControls.tsx
//   Create vault form     → src/components/vault/components/CreateVaultDialog.tsx
//
// This file: authentication gate + view routing only. ~100 lines.
// To change security behavior: touch useVaultSecurity.ts
// To change lobby layout:      touch VaultLobby.tsx
// To change item detail:       touch VaultDetailView.tsx
// To add a new dialog:         touch VaultSecurityDialogs.tsx

import React, { useState } from 'react';
import { Loader2, Shield, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MfaUnlock } from '@/components/mfa/MfaUnlock';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useSession } from '@supabase/auth-helpers-react';

// Modular vault architecture
import { useVaultSecurity, useVaultData } from '@/components/vault/hooks';
import { VaultLobby, VaultDetailView } from '@/components/vault/components';

// Re-export VaultItem type for components that import from this page
export type { VaultItem } from '@/components/vault/types';

const VaultPage: React.FC = () => {
  const { profile, loading: authLoading, session } = useAuth();

  // Dialog state — owned by orchestrator, passed down to lobby
  const [showSecuritySettings, setShowSecuritySettings] = useState(false);
  const [showEnableMfa, setShowEnableMfa] = useState(false);

  const security = useVaultSecurity(setShowEnableMfa, setShowSecuritySettings);
  const data = useVaultData(security.isVaultAccessible);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (authLoading || security.mfaLoading || !profile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin" />
          <h1 className="mt-4 text-xl md:text-2xl font-semibold">Loading...</h1>
        </div>
      </div>
    );
  }

  // ── MFA Gate ──────────────────────────────────────────────────────────────
  if (security.securityLevel === 'enhanced' && profile.mfa_enrolled && !security.isUnlocked) {
    return (
      <div className="container mx-auto p-4 md:p-8 max-w-lg">
        <div className="text-center mb-6">
          <Shield className="mx-auto h-12 w-12 text-primary mb-2" />
          <h1 className="text-xl md:text-2xl font-bold">Enhanced Security Active</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Enter your authentication code to access your vault.
          </p>
        </div>
        <div className="bg-card rounded-lg border p-4 md:p-6">
          <MfaUnlock onSuccess={security.unlockVault} />
        </div>
        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => security.handleSecurityLevelChange(false)}
            className="text-muted-foreground"
          >
            <ShieldOff className="h-4 w-4 mr-2" />
            Switch to basic security
          </Button>
        </div>
      </div>
    );
  }

  // ── Challenge handler (needs session — stays in orchestrator) ─────────────
  const handleChallenge = async (item: any, purchasePrice: number, askingPrice: number) => {
    if (!session) return;
    const toastId = toast.loading('Submitting item to the Arena...');
    try {
      const res = await fetch('/api/arena/challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          vault_item_id: item.id,
          purchase_price: purchasePrice,
          asking_price: askingPrice,
          item_name: item.asset_name,
          primary_photo_url: item.photos?.[0] || null,
          description: item.notes || '',
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to start challenge.');
      toast.success('Item successfully listed in the Arena!', { id: toastId });
    } catch (err) {
      toast.error('Failed to start challenge', { id: toastId, description: (err as Error).message });
    }
  };

  // ── View routing ──────────────────────────────────────────────────────────
  if (!data.selectedVault) {
    return (
      <VaultLobby
        vaults={data.vaults}
        isVaultsLoading={data.isVaultsLoading}
        vaultsError={data.vaultsError ?? null}
        onSelectVault={data.setSelectedVault}
        newVaultName={data.newVaultName}
        newVaultDescription={data.newVaultDescription}
        isPendingCreate={data.createVaultMutation.isPending}
        onNameChange={data.setNewVaultName}
        onDescriptionChange={data.setNewVaultDescription}
        onCreateVault={data.handleCreateVault}
        securityLevel={security.securityLevel}
        isTrustedDevice={security.isTrustedDevice}
        trustedUntil={security.trustedUntil}
        mfaEnrolled={profile.mfa_enrolled ?? false}
        onSecurityLevelChange={security.handleSecurityLevelChange}
        onLockVault={security.handleLockVault}
        onForgetDevice={security.handleForgetDevice}
        onLockAndForget={security.handleLockAndForget}
        onMfaSetupSuccess={security.handleMfaSetupSuccess}
        userId={profile.id}
      />
    );
  }

  return (
    <VaultDetailView
      vault={data.selectedVault}
      items={data.vaultItems}
      isLoading={data.isItemsLoading}
      securityLevel={security.securityLevel}
      isTrustedDevice={security.isTrustedDevice}
      trustedUntil={security.trustedUntil}
      mfaEnrolled={profile.mfa_enrolled ?? false}
      onOpenSecuritySettings={() => setShowSecuritySettings(true)}
      onLock={() => security.handleLockVault(() => {})}
      onForgetDevice={() => security.handleForgetDevice(() => {})}
      onLockAndForget={() => security.handleLockAndForget(() => {}, () => data.setSelectedVault(null))}
      onUpdateItem={data.handleUpdateItem}
      onBack={() => data.setSelectedVault(null)}
      onChallenge={handleChallenge}
    />
  );
};

export default VaultPage;