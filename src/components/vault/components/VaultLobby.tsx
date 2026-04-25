// FILE: src/components/vault/components/VaultLobby.tsx
// The vault lobby — grid of vaults + scan intelligence section.
// Add new sections to the vault lobby HERE without touching security or dialogs.

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, ShieldCheck, Unlock, Smartphone, Vault as VaultIcon, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import ScanHistoryTimeline from '@/components/history/ScanHistoryTimeline';
import VaultSummaryCard from '@/components/history/VaultSummaryCard';
import { VaultCard } from './VaultCard';
import { VaultSkeletonLoader } from './VaultSkeletonLoader';
import { VaultSecurityControls } from './VaultSecurityControls';
import { VaultSecurityDialogs } from './VaultSecurityDialogs';
import { CreateVaultDialog } from './CreateVaultDialog';
import type { VaultType, SecurityLevel } from '../types';

interface VaultLobbyProps {
  // Data
  vaults: VaultType[] | undefined;
  isVaultsLoading: boolean;
  vaultsError: Error | null;
  // Vault selection
  onSelectVault: (vault: VaultType) => void;
  // Create vault
  newVaultName: string;
  newVaultDescription: string;
  isPendingCreate: boolean;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onCreateVault: (onClose: () => void) => void;
  // Security props
  securityLevel: SecurityLevel;
  isTrustedDevice: boolean;
  trustedUntil: Date | null | undefined;
  mfaEnrolled: boolean;
  onSecurityLevelChange: (enable: boolean) => void;
  onLockVault: (closeDialog: () => void) => void;
  onForgetDevice: (closeDialog: () => void) => void;
  onLockAndForget: (closeDialog: () => void, clearVault: () => void) => void;
  onMfaSetupSuccess: () => void;
  // User
  userId: string;
}

export const VaultLobby: React.FC<VaultLobbyProps> = ({
  vaults, isVaultsLoading, vaultsError, onSelectVault,
  newVaultName, newVaultDescription, isPendingCreate,
  onNameChange, onDescriptionChange, onCreateVault,
  securityLevel, isTrustedDevice, trustedUntil, mfaEnrolled,
  onSecurityLevelChange, onLockVault, onForgetDevice, onLockAndForget, onMfaSetupSuccess,
  userId,
}) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showSecuritySettings, setShowSecuritySettings] = useState(false);
  const [showEnableMfa, setShowEnableMfa] = useState(false);
  const [showLock, setShowLock] = useState(false);
  const [showForgetDevice, setShowForgetDevice] = useState(false);
  const [showLockAndForget, setShowLockAndForget] = useState(false);

  return (
    <motion.div
      className="container mx-auto p-4 md:p-8"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 md:mb-8">
        <div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <h1 className="text-2xl md:text-4xl font-bold tracking-wider">My Vaults</h1>
            <Badge variant="outline" className={securityLevel === 'enhanced'
              ? 'text-green-400 border-green-400/50 bg-green-400/10'
              : 'text-blue-400 border-blue-400/50 bg-blue-400/10'
            }>
              {securityLevel === 'enhanced'
                ? <><ShieldCheck className="h-3 w-3 mr-1" />Enhanced</>
                : <><Unlock className="h-3 w-3 mr-1" />Basic</>
              }
            </Badge>
          </div>
          {securityLevel === 'enhanced' && isTrustedDevice && trustedUntil && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                <Smartphone className="h-3 w-3 mr-1" />Trusted Device
              </Badge>
              <span className="text-xs text-muted-foreground">until {trustedUntil.toLocaleDateString()}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <VaultSecurityControls
            securityLevel={securityLevel}
            isTrustedDevice={isTrustedDevice}
            trustedUntil={trustedUntil}
            mfaEnrolled={mfaEnrolled}
            onOpenSecuritySettings={() => setShowSecuritySettings(true)}
            onLock={() => setShowLock(true)}
            onForgetDevice={() => setShowForgetDevice(true)}
            onLockAndForget={() => setShowLockAndForget(true)}
          />
          <Button onClick={() => setIsCreateOpen(true)} size="default" className="touch-manipulation">
            <Plus className="mr-1 md:mr-2 h-4 md:h-5 w-4 md:w-5" />
            <span className="hidden sm:inline">Create New Vault</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Vault Grid */}
      {isVaultsLoading && <VaultSkeletonLoader />}

      {vaultsError && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Error Loading Vaults</AlertTitle>
          <AlertDescription>
            There was a problem fetching your vaults.
            <p className="text-xs mt-2">{vaultsError.message}</p>
          </AlertDescription>
        </Alert>
      )}

      {!isVaultsLoading && !vaultsError && vaults && vaults.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {vaults.map(vault => (
            <VaultCard key={vault.id} vault={vault} onSelect={() => onSelectVault(vault)} />
          ))}
        </div>
      )}

      {!isVaultsLoading && !vaultsError && (!vaults || vaults.length === 0) && (
        <div className="text-center py-12 md:py-16 border-2 border-dashed rounded-lg">
          <VaultIcon className="mx-auto h-12 md:h-16 w-12 md:w-16 text-gray-400 mb-4" />
          <h2 className="text-xl md:text-2xl font-semibold">No Vaults Yet</h2>
          <p className="text-muted-foreground mt-2 text-sm md:text-base px-4">
            Create your first vault to start organizing your collection.
          </p>
          <Button onClick={() => setIsCreateOpen(true)} size="lg" className="mt-4 touch-manipulation">
            <Plus className="mr-2 h-5 w-5" />Create Your First Vault
          </Button>
        </div>
      )}

      {/* ── RH-020: Scan Intelligence ──────────────────────────────────────
          Every item the user has ever scanned — price history, trends,
          total portfolio value. Fetches from /api/scan-history.
          Add new intelligence sections HERE without touching other files.
          ─────────────────────────────────────────────────────────────────*/}
      <div className="mt-10 space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-white/70">Scan Intelligence</h2>
          <Badge variant="outline" className="text-xs text-purple-400 border-purple-400/30">RH-020</Badge>
        </div>
        <p className="text-sm text-white/30 -mt-2">
          Every item you've scanned — price history, trends, and total portfolio value.
        </p>
        <VaultSummaryCard
          userId={userId}
          onItemSelect={itemName => toast.info(`Scan history: ${itemName}`)}
        />
        <ScanHistoryTimeline userId={userId} limit={15} />
      </div>

      {/* Dialogs — all in one component */}
      <CreateVaultDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        name={newVaultName}
        description={newVaultDescription}
        isPending={isPendingCreate}
        onNameChange={onNameChange}
        onDescriptionChange={onDescriptionChange}
        onSubmit={() => onCreateVault(() => setIsCreateOpen(false))}
      />

      <VaultSecurityDialogs
        securityLevel={securityLevel}
        mfaEnrolled={mfaEnrolled}
        isTrustedDevice={isTrustedDevice}
        showSecuritySettings={showSecuritySettings}
        showEnableMfa={showEnableMfa}
        showLock={showLock}
        showForgetDevice={showForgetDevice}
        showLockAndForget={showLockAndForget}
        onSecuritySettingsClose={setShowSecuritySettings}
        onEnableMfaClose={setShowEnableMfa}
        onLockClose={setShowLock}
        onForgetDeviceClose={setShowForgetDevice}
        onLockAndForgetClose={setShowLockAndForget}
        onSecurityLevelChange={onSecurityLevelChange}
        onMfaSetupSuccess={onMfaSetupSuccess}
        onLockConfirm={() => onLockVault(() => setShowLock(false))}
        onForgetDeviceConfirm={() => onForgetDevice(() => setShowForgetDevice(false))}
        onLockAndForgetConfirm={() => onLockAndForget(() => setShowLockAndForget(false), () => {})}
      />
    </motion.div>
  );
};