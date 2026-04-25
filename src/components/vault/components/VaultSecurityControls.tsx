// FILE: src/components/vault/components/VaultSecurityControls.tsx
// The security dropdown — isolated from dialog logic.
// Add/change security options HERE without touching dialogs or vault pages.

import React from 'react';
import { Settings, ShieldCheck, Shield, ShieldOff, Lock, Smartphone, LogOut, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SecurityLevel } from '../types';

interface VaultSecurityControlsProps {
  securityLevel: SecurityLevel;
  isTrustedDevice: boolean;
  trustedUntil: Date | null | undefined;
  mfaEnrolled: boolean;
  onOpenSecuritySettings: () => void;
  onLock: () => void;
  onForgetDevice: () => void;
  onLockAndForget: () => void;
}

export const VaultSecurityControls: React.FC<VaultSecurityControlsProps> = ({
  securityLevel, isTrustedDevice, trustedUntil, mfaEnrolled,
  onOpenSecuritySettings, onLock, onForgetDevice, onLockAndForget,
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm" className="gap-2 touch-manipulation">
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline">Security</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-64">
      <DropdownMenuLabel className="flex items-center gap-2">
        {securityLevel === 'enhanced'
          ? <ShieldCheck className="h-4 w-4 text-green-500" />
          : <Shield className="h-4 w-4 text-blue-500" />
        }
        Vault Security
      </DropdownMenuLabel>
      <DropdownMenuSeparator />

      <div className="px-2 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-sm">Enhanced Security</span>
          </div>
          <Switch
            checked={securityLevel === 'enhanced'}
            onCheckedChange={onOpenSecuritySettings}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-6">
          {securityLevel === 'enhanced' ? 'MFA required to access vault' : 'Basic password protection'}
        </p>
      </div>

      <DropdownMenuSeparator />

      {securityLevel === 'enhanced' && mfaEnrolled && (
        <>
          <DropdownMenuItem onClick={onLock} className="cursor-pointer">
            <Lock className="h-4 w-4 mr-2" />
            <div><div>Lock Vault</div><div className="text-xs text-muted-foreground">Keep device trusted</div></div>
          </DropdownMenuItem>

          {isTrustedDevice && (
            <DropdownMenuItem onClick={onForgetDevice} className="cursor-pointer">
              <ShieldOff className="h-4 w-4 mr-2" />
              <div><div>Forget This Device</div><div className="text-xs text-muted-foreground">Remove 30-day trust</div></div>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={onLockAndForget} className="cursor-pointer text-orange-500 focus:text-orange-500">
            <LogOut className="h-4 w-4 mr-2" />
            <div><div>Lock & Forget Device</div><div className="text-xs text-muted-foreground">Maximum security</div></div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
        </>
      )}

      <div className="px-2 py-1.5 text-xs text-muted-foreground">
        {securityLevel === 'enhanced' && isTrustedDevice ? (
          <div className="flex items-center gap-1">
            <Smartphone className="h-3 w-3" />
            Trusted until {trustedUntil?.toLocaleDateString()}
          </div>
        ) : securityLevel === 'enhanced' ? (
          <div className="flex items-center gap-1"><Lock className="h-3 w-3" />Session-only access</div>
        ) : (
          <div className="flex items-center gap-1"><Info className="h-3 w-3" />Standard protection active</div>
        )}
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
);