// FILE: src/pages/Vault.tsx
// FIXED: MFA is now OPTIONAL - users can access vault without MFA
// Enhanced security is opt-in via security settings
// Mobile-first design improvements

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMfa } from '../contexts/MfaContext';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { MfaSetup } from '../components/mfa/MfaSetup';
import { MfaUnlock } from '../components/mfa/MfaUnlock';
import { VaultItemCard } from '../components/vault/VaultItemCard';
import { PdfDownloadButton } from '../components/vault/PdfDownloadButton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Loader2, 
  ShieldAlert, 
  Plus, 
  Vault, 
  ChevronLeft, 
  DollarSign, 
  ShieldCheck, 
  Smartphone,
  Lock,
  Unlock,
  Settings,
  ShieldOff,
  LogOut,
  Shield,
  Info
} from 'lucide-react';
import { ItemDetailModal } from '@/components/vault/ItemDetailModal';
import ChallengeConfirmationModal from '@/components/arena/ChallengeConfirmationModal';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export interface VaultItem {
  id: string;
  vault_id: string;
  asset_name: string;
  valuation_data: {
    decision: string;
    estimatedValue: string;
    confidence: string;
    reasoning: string;
    comps: any[];
    grade?: string;
  } | null;
  photos: string[] | null;
  notes: string | null;
  serial_number: string | null;
  receipt_url: string | null;
  owner_valuation: number | null;
  provenance_documents: string[] | null;
  created_at: string;
  updated_at: string;
}

interface VaultType {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
  total_value?: number;
}

// Security level type
type SecurityLevel = 'basic' | 'enhanced';

const VaultSkeletonLoader = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="bg-gray-800/20 backdrop-blur-sm p-4 rounded-lg animate-pulse">
        <div className="w-full h-40 md:h-48 bg-gray-700/50 rounded-md mb-4"></div>
        <div className="h-6 w-3/4 bg-gray-700/50 rounded"></div>
        <div className="h-4 w-1/2 bg-gray-700/50 rounded mt-2"></div>
      </div>
    ))}
  </div>
);

const VaultCard: React.FC<{
  vault: VaultType;
  onSelect: () => void;
}> = ({ vault, onSelect }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-gray-800/50 backdrop-blur-sm p-4 md:p-6 rounded-lg cursor-pointer hover:bg-gray-800/70 transition-all touch-manipulation"
    onClick={onSelect}
  >
    <div className="flex items-start justify-between mb-4">
      <Vault className="h-6 w-6 md:h-8 md:w-8 text-purple-400" />
      <div className="text-right">
        <p className="text-xl md:text-2xl font-bold">{vault.item_count || 0}</p>
        <p className="text-xs md:text-sm text-gray-400">items</p>
      </div>
    </div>
    <h3 className="text-lg md:text-xl font-semibold mb-2 line-clamp-1">{vault.name}</h3>
    {vault.description && (
      <p className="text-xs md:text-sm text-gray-400 mb-3 line-clamp-2">{vault.description}</p>
    )}
    {vault.total_value !== undefined && vault.total_value > 0 && (
      <div className="flex items-center text-green-400">
        <DollarSign className="h-4 w-4 mr-1" />
        <span className="font-semibold">
          {vault.total_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </span>
      </div>
    )}
  </motion.div>
);

const VaultPage: React.FC = () => {
  const { profile, loading: authLoading, session, refreshProfile } = useAuth();
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
    bypassMfa
  } = useMfa();
  const queryClient = useQueryClient();

  const [selectedVault, setSelectedVault] = useState<VaultType | null>(null);
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [itemToChallenge, setItemToChallenge] = useState<VaultItem | null>(null);
  const [isCreateVaultOpen, setIsCreateVaultOpen] = useState(false);
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultDescription, setNewVaultDescription] = useState('');
  
  // Security dialogs
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showForgetDeviceDialog, setShowForgetDeviceDialog] = useState(false);
  const [showLockAndForgetDialog, setShowLockAndForgetDialog] = useState(false);
  const [showSecuritySettingsDialog, setShowSecuritySettingsDialog] = useState(false);
  const [showEnableMfaDialog, setShowEnableMfaDialog] = useState(false);

  // FIXED: Determine if vault should be accessible
  // Now: Vault is accessible if security is 'basic' OR if security is 'enhanced' and MFA is unlocked
  const isVaultAccessible = securityLevel === 'basic' || (securityLevel === 'enhanced' && isUnlocked);

  // Handler for successful MFA setup
  const handleMfaSetupSuccess = async () => {
    console.log('[Vault] MFA setup success callback triggered');
    
    await queryClient.invalidateQueries({ queryKey: ['profile'] });
    
    if (typeof refreshProfile === 'function') {
      await refreshProfile();
    }
    
    toast.success("MFA enabled! Your vault now has enhanced security.");
    setShowEnableMfaDialog(false);
  };

  // Lock handlers
  const handleLockVault = () => {
    lockVault(false);
    setSelectedVault(null);
    toast.success("Vault locked", { 
      description: "Your device is still trusted. You'll need to enter your code to unlock again." 
    });
    setShowLockDialog(false);
  };

  const handleForgetDevice = () => {
    forgetThisDevice();
    toast.success("Device forgotten", { 
      description: "This device is no longer trusted. You'll need to verify on next unlock." 
    });
    setShowForgetDeviceDialog(false);
  };

  const handleLockAndForget = () => {
    lockVault(true);
    setSelectedVault(null);
    toast.success("Vault locked & device forgotten", { 
      description: "You'll need to enter your authenticator code to access your vault again." 
    });
    setShowLockAndForgetDialog(false);
  };

  // Security level toggle handler
  const handleSecurityLevelChange = async (enableEnhanced: boolean) => {
    if (enableEnhanced) {
      // Check if MFA is enrolled
      if (!profile?.mfa_enrolled) {
        // Need to set up MFA first
        setShowSecuritySettingsDialog(false);
        setShowEnableMfaDialog(true);
        return;
      }
      // MFA is enrolled, enable enhanced security
      setSecurityLevel('enhanced');
      toast.success("Enhanced security enabled", {
        description: "MFA will now be required to access your vault."
      });
    } else {
      // Downgrade to basic security
      setSecurityLevel('basic');
      // Auto-unlock when switching to basic
      bypassMfa();
      toast.info("Basic security enabled", {
        description: "You can access your vault without MFA verification."
      });
    }
    setShowSecuritySettingsDialog(false);
  };

  // Fetch all vaults
  const fetchVaults = async (): Promise<VaultType[]> => {
    if (!session?.access_token) {
      throw new Error('Authentication token not found.');
    }
    
    const response = await fetch('/api/vault', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch vaults');
    }
    
    return response.json();
  };

  // FIXED: Enable query when vault is accessible (not just when MFA is unlocked)
  const { data: vaults, isLoading: isVaultsLoading, error: vaultsError } = useQuery<VaultType[], Error>({
    queryKey: ['vaults'],
    queryFn: fetchVaults,
    enabled: !!session?.access_token && isVaultAccessible,
  });

  // Fetch items for selected vault
  const fetchVaultItems = async (vaultId: string): Promise<VaultItem[]> => {
    if (!session?.access_token) {
      throw new Error('Authentication token not found.');
    }
    
    const response = await fetch(`/api/vault/items?vaultId=${vaultId}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch items');
    }
    
    return response.json();
  };

  const { data: vaultItems, isLoading: isItemsLoading } = useQuery<VaultItem[], Error>({
    queryKey: ['vaultItems', selectedVault?.id],
    queryFn: () => fetchVaultItems(selectedVault!.id),
    enabled: !!session?.access_token && isVaultAccessible && !!selectedVault,
  });

  // Create vault mutation
  const createVaultMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const response = await fetch('/api/vault', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create vault');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vaults'] });
      toast.success('Vault created successfully');
      setIsCreateVaultOpen(false);
      setNewVaultName('');
      setNewVaultDescription('');
    },
    onError: (error: Error) => {
      toast.error('Failed to create vault', { description: error.message });
    },
  });

  const handleCreateVault = () => {
    if (!newVaultName.trim()) {
      toast.error('Vault name is required');
      return;
    }
    createVaultMutation.mutate({
      name: newVaultName.trim(),
      description: newVaultDescription.trim(),
    });
  };

  const handleConfirmChallenge = async (purchasePrice: number, askingPrice: number) => {
    if (!itemToChallenge || !session) return;

    const toastId = toast.loading("Submitting item to the Arena...");
    try {
      const response = await fetch('/api/arena/challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          vault_item_id: itemToChallenge.id,
          purchase_price: purchasePrice,
          asking_price: askingPrice,
          item_name: itemToChallenge.asset_name,
          primary_photo_url: itemToChallenge.photos?.[0] || null,
          description: itemToChallenge.notes || ''
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start challenge.");
      }

      toast.success("Item successfully listed in the Arena!", { id: toastId });
      setItemToChallenge(null);
    } catch (err) {
      toast.error("Failed to start challenge", { id: toastId, description: (err as Error).message });
    }
  };

  const handleUpdateItem = (updatedItem: VaultItem) => {
    queryClient.setQueryData(['vaultItems', selectedVault?.id], (oldData: VaultItem[] | undefined) =>
      oldData?.map(item => item.id === updatedItem.id ? updatedItem : item)
    );
    toast.success("Vault item updated successfully.");
  };

  // Loading state
  if (authLoading || mfaLoading || !profile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin" />
          <h1 className="mt-4 text-xl md:text-2xl font-semibold">Loading...</h1>
        </div>
      </div>
    );
  }

  // FIXED: Only show MFA unlock screen if enhanced security is enabled AND user has MFA enrolled
  if (securityLevel === 'enhanced' && profile.mfa_enrolled && !isUnlocked) {
    return (
      <div className="container mx-auto p-4 md:p-8 max-w-lg">
        <div className="text-center mb-6">
          <Shield className="mx-auto h-12 w-12 text-primary mb-2" />
          <h1 className="text-xl md:text-2xl font-bold">Enhanced Security Active</h1>
          <p className="text-muted-foreground text-sm md:text-base">Enter your authentication code to access your vault.</p>
        </div>
        <div className="bg-card rounded-lg border p-4 md:p-6">
          <MfaUnlock onSuccess={unlockVault} />
        </div>
        
        {/* Option to disable enhanced security */}
        <div className="mt-6 text-center">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => handleSecurityLevelChange(false)}
            className="text-muted-foreground"
          >
            <ShieldOff className="h-4 w-4 mr-2" />
            Switch to basic security
          </Button>
        </div>
      </div>
    );
  }

  // Vault Security Controls Component - UPDATED with security level toggle
  const VaultSecurityControls = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 touch-manipulation">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Security</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          {securityLevel === 'enhanced' ? (
            <ShieldCheck className="h-4 w-4 text-green-500" />
          ) : (
            <Shield className="h-4 w-4 text-blue-500" />
          )}
          Vault Security
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Security Level Toggle */}
        <div className="px-2 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm">Enhanced Security</span>
            </div>
            <Switch
              checked={securityLevel === 'enhanced'}
              onCheckedChange={(checked) => {
                setShowSecuritySettingsDialog(true);
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-6">
            {securityLevel === 'enhanced' 
              ? 'MFA required to access vault' 
              : 'Basic password protection'}
          </p>
        </div>
        
        <DropdownMenuSeparator />
        
        {/* Only show lock options if enhanced security is enabled */}
        {securityLevel === 'enhanced' && profile.mfa_enrolled && (
          <>
            <DropdownMenuItem 
              onClick={() => setShowLockDialog(true)}
              className="cursor-pointer"
            >
              <Lock className="h-4 w-4 mr-2" />
              <div>
                <div>Lock Vault</div>
                <div className="text-xs text-muted-foreground">Keep device trusted</div>
              </div>
            </DropdownMenuItem>

            {isTrustedDevice && (
              <DropdownMenuItem 
                onClick={() => setShowForgetDeviceDialog(true)}
                className="cursor-pointer"
              >
                <ShieldOff className="h-4 w-4 mr-2" />
                <div>
                  <div>Forget This Device</div>
                  <div className="text-xs text-muted-foreground">Remove 30-day trust</div>
                </div>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem 
              onClick={() => setShowLockAndForgetDialog(true)}
              className="cursor-pointer text-orange-500 focus:text-orange-500"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <div>
                <div>Lock & Forget Device</div>
                <div className="text-xs text-muted-foreground">Maximum security</div>
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
          </>
        )}

        {/* Status Info */}
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {securityLevel === 'enhanced' && isTrustedDevice ? (
            <div className="flex items-center gap-1">
              <Smartphone className="h-3 w-3" />
              Trusted until {trustedUntil?.toLocaleDateString()}
            </div>
          ) : securityLevel === 'enhanced' ? (
            <div className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Session-only access
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              Standard protection active
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Show vault lobby if no vault is selected
  if (!selectedVault) {
    return (
      <motion.div
        className="container mx-auto p-4 md:p-8"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 md:mb-8">
          <div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <h1 className="text-2xl md:text-4xl font-bold tracking-wider">My Vaults</h1>
              <Badge 
                variant="outline" 
                className={`${
                  securityLevel === 'enhanced' 
                    ? 'text-green-400 border-green-400/50 bg-green-400/10' 
                    : 'text-blue-400 border-blue-400/50 bg-blue-400/10'
                }`}
              >
                {securityLevel === 'enhanced' ? (
                  <>
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Enhanced
                  </>
                ) : (
                  <>
                    <Unlock className="h-3 w-3 mr-1" />
                    Basic
                  </>
                )}
              </Badge>
            </div>
            {/* Trusted Device Indicator */}
            {securityLevel === 'enhanced' && isTrustedDevice && trustedUntil && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  <Smartphone className="h-3 w-3 mr-1" />
                  Trusted Device
                </Badge>
                <span className="text-xs text-muted-foreground">
                  until {trustedUntil.toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <VaultSecurityControls />
            <Button onClick={() => setIsCreateVaultOpen(true)} size="default" className="touch-manipulation">
              <Plus className="mr-1 md:mr-2 h-4 md:h-5 w-4 md:w-5" />
              <span className="hidden sm:inline">Create New Vault</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>

        {isVaultsLoading && <VaultSkeletonLoader />}

        {vaultsError && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Error Loading Vaults</AlertTitle>
            <AlertDescription>
              There was a problem fetching your vaults. Please try again later.
              <p className="text-xs mt-2">{vaultsError.message}</p>
            </AlertDescription>
          </Alert>
        )}

        {!isVaultsLoading && !vaultsError && vaults && vaults.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {vaults.map((vault) => (
              <VaultCard
                key={vault.id}
                vault={vault}
                onSelect={() => setSelectedVault(vault)}
              />
            ))}
          </div>
        )}

        {!isVaultsLoading && !vaultsError && (!vaults || vaults.length === 0) && (
          <div className="text-center py-12 md:py-16 border-2 border-dashed rounded-lg">
            <Vault className="mx-auto h-12 md:h-16 w-12 md:w-16 text-gray-400 mb-4" />
            <h2 className="text-xl md:text-2xl font-semibold">No Vaults Yet</h2>
            <p className="text-muted-foreground mt-2 text-sm md:text-base px-4">Create your first vault to start organizing your collection.</p>
            <Button onClick={() => setIsCreateVaultOpen(true)} size="lg" className="mt-4 touch-manipulation">
              <Plus className="mr-2 h-5 w-5" />
              Create Your First Vault
            </Button>
          </div>
        )}

        {/* Create Vault Dialog */}
        <Dialog open={isCreateVaultOpen} onOpenChange={setIsCreateVaultOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Vault</DialogTitle>
              <DialogDescription>
                Organize your collection with custom vaults. Each vault can store different types of items.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="vault-name">Vault Name</Label>
                <Input
                  id="vault-name"
                  value={newVaultName}
                  onChange={(e) => setNewVaultName(e.target.value)}
                  placeholder="e.g., Luxury Watches, Sports Memorabilia"
                  maxLength={100}
                />
              </div>
              <div>
                <Label htmlFor="vault-description">Description (Optional)</Label>
                <Textarea
                  id="vault-description"
                  value={newVaultDescription}
                  onChange={(e) => setNewVaultDescription(e.target.value)}
                  placeholder="Describe what this vault will contain..."
                  maxLength={500}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setIsCreateVaultOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={handleCreateVault} disabled={createVaultMutation.isPending} className="w-full sm:w-auto">
                {createVaultMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Vault'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Security Settings Confirmation Dialog */}
        <AlertDialog open={showSecuritySettingsDialog} onOpenChange={setShowSecuritySettingsDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                {securityLevel === 'basic' ? (
                  <>
                    <ShieldCheck className="h-5 w-5 text-green-500" />
                    Enable Enhanced Security?
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-5 w-5 text-orange-500" />
                    Disable Enhanced Security?
                  </>
                )}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {securityLevel === 'basic' ? (
                  <>
                    Enhanced security requires MFA (two-factor authentication) to access your vault.
                    This provides additional protection for your valuable items.
                    {!profile.mfa_enrolled && (
                      <span className="block mt-2 text-amber-600">
                        You'll need to set up an authenticator app first.
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    Switching to basic security will allow vault access with just your password.
                    <span className="block mt-2 text-orange-500">
                      Your items will be less protected against unauthorized access.
                    </span>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => handleSecurityLevelChange(securityLevel === 'basic')}
                className={securityLevel === 'basic' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600'}
              >
                {securityLevel === 'basic' ? 'Enable Enhanced Security' : 'Switch to Basic'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Enable MFA Dialog */}
        <Dialog open={showEnableMfaDialog} onOpenChange={setShowEnableMfaDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Set Up Two-Factor Authentication
              </DialogTitle>
              <DialogDescription>
                Enhanced security requires MFA. Set up your authenticator app to continue.
              </DialogDescription>
            </DialogHeader>
            <MfaSetup onSuccess={handleMfaSetupSuccess} />
          </DialogContent>
        </Dialog>

        {/* Lock Vault Confirmation */}
        <AlertDialog open={showLockDialog} onOpenChange={setShowLockDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Lock Vault?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Your vault will be locked and you'll need to enter your authenticator code to access it again.
                {isTrustedDevice && (
                  <span className="block mt-2 text-green-600">
                    ✓ This device will remain trusted for quick unlock next time.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLockVault}>
                Lock Vault
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Forget Device Confirmation */}
        <AlertDialog open={showForgetDeviceDialog} onOpenChange={setShowForgetDeviceDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <ShieldOff className="h-5 w-5" />
                Forget This Device?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This device will no longer be trusted. Next time you lock and unlock, you'll need to enter your authenticator code.
                <span className="block mt-2">
                  Your vault will remain unlocked for this session.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleForgetDevice}>
                Forget Device
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Lock & Forget Confirmation */}
        <AlertDialog open={showLockAndForgetDialog} onOpenChange={setShowLockAndForgetDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-orange-500">
                <LogOut className="h-5 w-5" />
                Lock Vault & Forget Device?
              </AlertDialogTitle>
              <AlertDialogDescription>
                <span className="font-medium">Maximum security option:</span>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Your vault will be locked immediately</li>
                  <li>This device will no longer be trusted</li>
                  <li>You'll need your authenticator code to unlock</li>
                </ul>
                <span className="block mt-3 text-muted-foreground">
                  Recommended before traveling or using shared devices.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleLockAndForget}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Lock & Forget
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    );
  }

  // Show vault detail view
  return (
    <>
      <motion.div
        className="container mx-auto p-4 md:p-8"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 md:mb-8">
          <div className="flex items-start gap-2 md:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedVault(null)}
              className="touch-manipulation shrink-0"
            >
              <ChevronLeft className="h-5 md:h-6 w-5 md:w-6" />
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <h1 className="text-2xl md:text-4xl font-bold tracking-wider line-clamp-1">{selectedVault.name}</h1>
                <Badge variant="outline" className="text-green-400 border-green-400/50 bg-green-400/10">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Secured
                </Badge>
              </div>
              {selectedVault.description && (
                <p className="text-gray-400 mt-1 text-sm md:text-base line-clamp-2">{selectedVault.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 ml-8 sm:ml-0">
            <VaultSecurityControls />
            {vaultItems && vaultItems.length > 0 && (
              <PdfDownloadButton items={vaultItems} />
            )}
          </div>
        </div>

        {isItemsLoading && <VaultSkeletonLoader />}

        {!isItemsLoading && vaultItems && vaultItems.length > 0 && (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.05,
                },
              },
            }}
            initial="hidden"
            animate="show"
          >
            {vaultItems.map((item) => (
              <VaultItemCard
                key={item.id}
                item={item}
                onSelect={() => setSelectedItem(item)}
                onStartChallenge={() => setItemToChallenge(item)}
              />
            ))}
          </motion.div>
        )}

        {!isItemsLoading && (!vaultItems || vaultItems.length === 0) && (
          <div className="text-center py-12 md:py-16 border-2 border-dashed rounded-lg">
            <h2 className="text-xl md:text-2xl font-semibold">This Vault is Empty</h2>
            <p className="text-muted-foreground mt-2 text-sm md:text-base px-4">Add items from the analysis page to secure them in this vault.</p>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {selectedItem && (
          <ItemDetailModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onUpdate={handleUpdateItem}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {itemToChallenge && (
          <ChallengeConfirmationModal
            isOpen={!!itemToChallenge}
            onClose={() => setItemToChallenge(null)}
            item={itemToChallenge}
            onConfirm={handleConfirmChallenge}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default VaultPage;