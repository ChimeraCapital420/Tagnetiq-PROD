// FILE: src/pages/Vault.tsx
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
import { Loader2, ShieldAlert, Plus, Vault, ChevronLeft, DollarSign } from 'lucide-react';
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

interface Vault {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
  total_value?: number;
}

const VaultSkeletonLoader = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="bg-gray-800/20 backdrop-blur-sm p-4 rounded-lg animate-pulse">
        <div className="w-full h-48 bg-gray-700/50 rounded-md mb-4"></div>
        <div className="h-6 w-3/4 bg-gray-700/50 rounded"></div>
        <div className="h-4 w-1/2 bg-gray-700/50 rounded mt-2"></div>
      </div>
    ))}
  </div>
);

const VaultCard: React.FC<{
  vault: Vault;
  onSelect: () => void;
}> = ({ vault, onSelect }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-lg cursor-pointer hover:bg-gray-800/70 transition-all"
    onClick={onSelect}
  >
    <div className="flex items-start justify-between mb-4">
      <Vault className="h-8 w-8 text-purple-400" />
      <div className="text-right">
        <p className="text-2xl font-bold">{vault.item_count || 0}</p>
        <p className="text-sm text-gray-400">items</p>
      </div>
    </div>
    <h3 className="text-xl font-semibold mb-2">{vault.name}</h3>
    {vault.description && (
      <p className="text-sm text-gray-400 mb-3">{vault.description}</p>
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
  const { profile, loading: authLoading, session } = useAuth();
  const { isUnlocked, unlockVault } = useMfa();
  const queryClient = useQueryClient();

  const [selectedVault, setSelectedVault] = useState<Vault | null>(null);
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [itemToChallenge, setItemToChallenge] = useState<VaultItem | null>(null);
  const [isCreateVaultOpen, setIsCreateVaultOpen] = useState(false);
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultDescription, setNewVaultDescription] = useState('');

  // Fetch all vaults
  const fetchVaults = async (): Promise<Vault[]> => {
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

  const { data: vaults, isLoading: isVaultsLoading, error: vaultsError } = useQuery<Vault[], Error>({
    queryKey: ['vaults'],
    queryFn: fetchVaults,
    enabled: !!session?.access_token && isUnlocked,
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
    enabled: !!session?.access_token && isUnlocked && !!selectedVault,
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

  if (authLoading || !profile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin" />
          <h1 className="mt-4 text-2xl font-semibold">Loading Security Profile...</h1>
        </div>
      </div>
    );
  }

  if (!profile.mfa_enrolled) {
    return <MfaSetup onSuccess={() => queryClient.invalidateQueries({ queryKey: ['profile'] })} />;
  }

  if (profile.mfa_enrolled && !isUnlocked) {
    return <MfaUnlock onSuccess={unlockVault} />;
  }

  // Show vault lobby if no vault is selected
  if (!selectedVault) {
    return (
      <motion.div
        className="container mx-auto p-4 md:p-8"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold tracking-wider">My Vaults</h1>
          <Button onClick={() => setIsCreateVaultOpen(true)} size="lg">
            <Plus className="mr-2 h-5 w-5" />
            Create New Vault
          </Button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <Vault className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h2 className="text-2xl font-semibold">No Vaults Yet</h2>
            <p className="text-muted-foreground mt-2">Create your first vault to start organizing your collection.</p>
            <Button onClick={() => setIsCreateVaultOpen(true)} size="lg" className="mt-4">
              <Plus className="mr-2 h-5 w-5" />
              Create Your First Vault
            </Button>
          </div>
        )}

        {/* Create Vault Dialog */}
        <Dialog open={isCreateVaultOpen} onOpenChange={setIsCreateVaultOpen}>
          <DialogContent>
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateVaultOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateVault} disabled={createVaultMutation.isPending}>
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
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedVault(null)}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold tracking-wider">{selectedVault.name}</h1>
              {selectedVault.description && (
                <p className="text-gray-400 mt-1">{selectedVault.description}</p>
              )}
            </div>
          </div>
          {vaultItems && vaultItems.length > 0 && (
            <PdfDownloadButton items={vaultItems} />
          )}
        </div>

        {isItemsLoading && <VaultSkeletonLoader />}

        {!isItemsLoading && vaultItems && vaultItems.length > 0 && (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
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
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <h2 className="text-2xl font-semibold">This Vault is Empty</h2>
            <p className="text-muted-foreground mt-2">Add items from the analysis page to secure them in this vault.</p>
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