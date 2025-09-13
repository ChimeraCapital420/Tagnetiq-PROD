// FILE: src/components/vault/AddToVaultButton.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ShieldCheck, Loader2, Plus, Vault } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

interface AddToVaultButtonProps {
  analysisResult: any;
  onSuccess: () => void;
}

interface VaultOption {
  id: string;
  name: string;
  description: string | null;
  item_count?: number;
}

export const AddToVaultButton: React.FC<AddToVaultButtonProps> = ({ analysisResult, onSuccess }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVaultId, setSelectedVaultId] = useState<string>('');
  const [isCreatingNewVault, setIsCreatingNewVault] = useState(false);
  const [newVaultName, setNewVaultName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch user's vaults
  const { data: vaults, isLoading: isLoadingVaults, refetch } = useQuery<VaultOption[]>({
    queryKey: ['vaults-for-add'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch('/api/vault', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch vaults');
      }

      return response.json();
    },
    enabled: isDialogOpen,
  });

  const handleCreateVault = async () => {
    if (!newVaultName.trim()) {
      toast.error('Vault name is required');
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch('/api/vault', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newVaultName.trim(),
          description: `Created for ${analysisResult.itemName || 'new item'}`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create vault');
      }

      const newVault = await response.json();
      await refetch();
      setSelectedVaultId(newVault.id);
      setIsCreatingNewVault(false);
      setNewVaultName('');
      toast.success('Vault created successfully');
    } catch (error: any) {
      toast.error('Failed to create vault', { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToVault = async () => {
    if (!selectedVaultId) {
      toast.error('Please select a vault');
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading('Securing item in vault...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const payload = {
        vault_id: selectedVaultId,
        asset_name: analysisResult.itemName || 'Untitled Asset',
        valuation_data: analysisResult,
        photos: analysisResult.imageUrls || [],
      };

      const response = await fetch('/api/vault/items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add item to vault.');
      }

      const selectedVault = vaults?.find(v => v.id === selectedVaultId);
      toast.success(`${payload.asset_name} secured in ${selectedVault?.name}`, {
        id: toastId,
        action: {
          label: 'View Vault',
          onClick: () => navigate('/vault'),
        },
      });

      setIsDialogOpen(false);
      onSuccess();

    } catch (error: any) {
      toast.error("Failed to secure item", {
        id: toastId,
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button 
        onClick={() => setIsDialogOpen(true)} 
        size="lg" 
        className="w-full mt-4"
      >
        <ShieldCheck className="mr-2 h-5 w-5" />
        Secure in Vault
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Vault</DialogTitle>
            <DialogDescription>
              Choose which vault to store "{analysisResult.itemName || 'this item'}" in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isLoadingVaults ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                {!isCreatingNewVault && vaults && vaults.length > 0 && (
                  <RadioGroup value={selectedVaultId} onValueChange={setSelectedVaultId}>
                    {vaults.map((vault) => (
                      <div key={vault.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-800/50">
                        <RadioGroupItem value={vault.id} id={vault.id} />
                        <Label htmlFor={vault.id} className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Vault className="h-4 w-4 text-purple-400" />
                              <span className="font-medium">{vault.name}</span>
                            </div>
                            {vault.item_count !== undefined && (
                              <span className="text-sm text-gray-400">
                                {vault.item_count} items
                              </span>
                            )}
                          </div>
                          {vault.description && (
                            <p className="text-sm text-gray-400 mt-1">{vault.description}</p>
                          )}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {!isCreatingNewVault && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsCreatingNewVault(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Vault
                  </Button>
                )}

                {isCreatingNewVault && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="new-vault-name">Vault Name</Label>
                      <Input
                        id="new-vault-name"
                        value={newVaultName}
                        onChange={(e) => setNewVaultName(e.target.value)}
                        placeholder="e.g., Luxury Watches"
                        maxLength={100}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsCreatingNewVault(false);
                          setNewVaultName('');
                        }}
                        disabled={isLoading}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateVault}
                        disabled={isLoading || !newVaultName.trim()}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create Vault'
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {!isCreatingNewVault && (
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddToVault}
                disabled={isLoading || !selectedVaultId}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Securing...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Add to Vault
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};