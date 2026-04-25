// FILE: src/components/vault/hooks/useVaultSecurity.ts
// All MFA / security level logic isolated in one hook.
// Touch security behavior here ONLY — never in Vault.tsx.

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMfa } from '@/contexts/MfaContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

export function useVaultSecurity(
  setShowEnableMfaDialog: (v: boolean) => void,
  setShowSecuritySettingsDialog: (v: boolean) => void,
) {
  const { profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const {
    isUnlocked,
    unlockVault,
    lockVault,
    forgetThisDevice,
    isTrustedDevice,
    trustedUntil,
    isLoading: mfaLoading,
    securityLevel,
    setSecurityLevel,
    bypassMfa,
  } = useMfa();

  const isVaultAccessible =
    securityLevel === 'basic' || (securityLevel === 'enhanced' && isUnlocked);

  const handleMfaSetupSuccess = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['profile'] });
    if (typeof refreshProfile === 'function') await refreshProfile();
    toast.success('MFA enabled! Your vault now has enhanced security.');
    setShowEnableMfaDialog(false);
  }, [queryClient, refreshProfile, setShowEnableMfaDialog]);

  const handleLockVault = useCallback((closeDialog: () => void) => {
    lockVault(false);
    toast.success('Vault locked', { description: 'Your device is still trusted.' });
    closeDialog();
  }, [lockVault]);

  const handleForgetDevice = useCallback((closeDialog: () => void) => {
    forgetThisDevice();
    toast.success('Device forgotten', {
      description: 'You\'ll need to verify on next unlock.',
    });
    closeDialog();
  }, [forgetThisDevice]);

  const handleLockAndForget = useCallback((closeDialog: () => void, clearVault: () => void) => {
    lockVault(true);
    clearVault();
    toast.success('Vault locked & device forgotten');
    closeDialog();
  }, [lockVault]);

  const handleSecurityLevelChange = useCallback(async (enableEnhanced: boolean) => {
    if (enableEnhanced) {
      if (!profile?.mfa_enrolled) {
        setShowSecuritySettingsDialog(false);
        setShowEnableMfaDialog(true);
        return;
      }
      setSecurityLevel('enhanced');
      toast.success('Enhanced security enabled');
    } else {
      setSecurityLevel('basic');
      bypassMfa();
      toast.info('Basic security enabled');
    }
    setShowSecuritySettingsDialog(false);
  }, [profile?.mfa_enrolled, setSecurityLevel, bypassMfa, setShowEnableMfaDialog, setShowSecuritySettingsDialog]);

  return {
    isUnlocked,
    unlockVault,
    mfaLoading,
    securityLevel,
    isTrustedDevice,
    trustedUntil,
    isVaultAccessible,
    handleMfaSetupSuccess,
    handleLockVault,
    handleForgetDevice,
    handleLockAndForget,
    handleSecurityLevelChange,
  };
}