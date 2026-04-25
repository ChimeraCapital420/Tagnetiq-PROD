// FILE: src/components/vault/components/VaultSecurityDialogs.tsx
// All 5 security dialogs in one file.
// Change dialog copy/behavior HERE without touching any other file.

import React from 'react';
import { ShieldCheck, ShieldOff, Lock, LogOut } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MfaSetup } from '@/components/mfa/MfaSetup';
import type { SecurityLevel } from '../types';

interface SecurityDialogsProps {
  securityLevel: SecurityLevel;
  mfaEnrolled: boolean;
  isTrustedDevice: boolean;
  // Dialog open states
  showSecuritySettings: boolean;
  showEnableMfa: boolean;
  showLock: boolean;
  showForgetDevice: boolean;
  showLockAndForget: boolean;
  // Handlers
  onSecuritySettingsClose: (open: boolean) => void;
  onEnableMfaClose: (open: boolean) => void;
  onLockClose: (open: boolean) => void;
  onForgetDeviceClose: (open: boolean) => void;
  onLockAndForgetClose: (open: boolean) => void;
  onSecurityLevelChange: (enable: boolean) => void;
  onMfaSetupSuccess: () => void;
  onLockConfirm: () => void;
  onForgetDeviceConfirm: () => void;
  onLockAndForgetConfirm: () => void;
}

export const VaultSecurityDialogs: React.FC<SecurityDialogsProps> = ({
  securityLevel, mfaEnrolled, isTrustedDevice,
  showSecuritySettings, showEnableMfa, showLock, showForgetDevice, showLockAndForget,
  onSecuritySettingsClose, onEnableMfaClose, onLockClose, onForgetDeviceClose, onLockAndForgetClose,
  onSecurityLevelChange, onMfaSetupSuccess, onLockConfirm, onForgetDeviceConfirm, onLockAndForgetConfirm,
}) => (
  <>
    {/* Security Settings */}
    <AlertDialog open={showSecuritySettings} onOpenChange={onSecuritySettingsClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {securityLevel === 'basic'
              ? <><ShieldCheck className="h-5 w-5 text-green-500" />Enable Enhanced Security?</>
              : <><ShieldOff className="h-5 w-5 text-orange-500" />Disable Enhanced Security?</>
            }
          </AlertDialogTitle>
          <AlertDialogDescription>
            {securityLevel === 'basic' ? (
              <>
                Enhanced security requires MFA to access your vault.
                {!mfaEnrolled && (
                  <span className="block mt-2 text-amber-600">
                    You'll need to set up an authenticator app first.
                  </span>
                )}
              </>
            ) : (
              <>
                Switching to basic security allows vault access with just your password.
                <span className="block mt-2 text-orange-500">Your items will be less protected.</span>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onSecurityLevelChange(securityLevel === 'basic')}
            className={securityLevel === 'basic' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600'}
          >
            {securityLevel === 'basic' ? 'Enable Enhanced Security' : 'Switch to Basic'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Enable MFA */}
    <Dialog open={showEnableMfa} onOpenChange={onEnableMfaClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />Set Up Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>Enhanced security requires MFA. Set up your authenticator app to continue.</DialogDescription>
        </DialogHeader>
        <MfaSetup onSuccess={onMfaSetupSuccess} />
      </DialogContent>
    </Dialog>

    {/* Lock Vault */}
    <AlertDialog open={showLock} onOpenChange={onLockClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />Lock Vault?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Your vault will be locked. You'll need your authenticator code to access it again.
            {isTrustedDevice && (
              <span className="block mt-2 text-green-600">
                ✓ This device will remain trusted for quick unlock next time.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onLockConfirm}>Lock Vault</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Forget Device */}
    <AlertDialog open={showForgetDevice} onOpenChange={onForgetDeviceClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5" />Forget This Device?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This device will no longer be trusted.
            <span className="block mt-2">Your vault will remain unlocked for this session.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onForgetDeviceConfirm}>Forget Device</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Lock & Forget */}
    <AlertDialog open={showLockAndForget} onOpenChange={onLockAndForgetClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-orange-500">
            <LogOut className="h-5 w-5" />Lock Vault & Forget Device?
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium">Maximum security option:</span>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Vault locked immediately</li>
              <li>This device no longer trusted</li>
              <li>Authenticator code required to unlock</li>
            </ul>
            <span className="block mt-3 text-muted-foreground">
              Recommended before traveling or using shared devices.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onLockAndForgetConfirm} className="bg-orange-500 hover:bg-orange-600">
            Lock & Forget
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
);