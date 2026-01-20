// FILE: src/components/vault/AddToVaultButton.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ShieldCheck, Loader2, Plus, Vault, ChevronLeft, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
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

type DialogStep = 'select' | 'create' | 'success';

export const AddToVaultButton: React.FC<AddToVaultButtonProps> = ({ analysisResult, onSuccess }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<DialogStep>('select');
  const [selectedVaultId, setSelectedVaultId] = useState<string>('');
  const [newVaultName, setNewVaultName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [addedToVault, setAddedToVault] = useState<VaultOption | null>(null);
  const navigate = useNavigate();

  // Fetch user's vaults
  const { data: vaults, isLoading: isLoadingVaults, error: vaultsError, refetch } = useQuery<VaultOption[]>({
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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch vaults');
      }

      return response.json();
    },
    enabled: isDialogOpen,
    retry: 1,
  });

  // Auto-select first vault if available and none selected
  useEffect(() => {
    if (vaults && vaults.length > 0 && !selectedVaultId) {
      setSelectedVaultId(vaults[0].id);
    }
  }, [vaults, selectedVaultId]);

  // Reset dialog state when opened
  useEffect(() => {
    if (isDialogOpen) {
      setDialogStep('select');
      setAddedToVault(null);
      setNewVaultName('');
    } else {
      setSelectedVaultId('');
    }
  }, [isDialogOpen]);

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
          description: null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create vault');
      }

      const newVault = await response.json();
      await refetch();
      setSelectedVaultId(newVault.id);
      setDialogStep('select');
      setNewVaultName('');
      toast.success(`"${newVault.name}" created!`);
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
      setAddedToVault(selectedVault || { id: selectedVaultId, name: 'Vault', description: null });
      setDialogStep('success');
      onSuccess();

    } catch (error: any) {
      toast.error("Failed to secure item", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsDialogOpen(false);
  };

  const selectedVault = vaults?.find(v => v.id === selectedVaultId);
  const hasVaults = vaults && vaults.length > 0;

  const renderSelectStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Vault className="h-5 w-5 text-purple-400" />
          Secure in Vault
        </DialogTitle>
        <DialogDescription>
          Choose a vault to store "{analysisResult.itemName || 'this item'}".
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {/* Vault Selection Dropdown */}
        <div className="space-y-2">
          <Label htmlFor="vault-select">Select Vault</Label>
          
          {isLoadingVaults ? (
            <div className="flex items-center justify-center py-4 border rounded-md bg-gray-800/30">
              <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
              <span className="ml-2 text-gray-400 text-sm">Loading vaults...</span>
            </div>
          ) : vaultsError ? (
            <div className="flex items-center justify-between p-3 border border-yellow-500/30 rounded-md bg-yellow-500/10">
              <div className="flex items-center gap-2 text-yellow-400">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Couldn't load vaults</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => refetch()}
                className="h-7 text-yellow-400 hover:text-yellow-300"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          ) : hasVaults ? (
            <Select value={selectedVaultId} onValueChange={setSelectedVaultId}>
              <SelectTrigger id="vault-select" className="w-full">
                <SelectValue placeholder="Choose a vault...">
                  {selectedVault && (
                    <div className="flex items-center gap-2">
                      <Vault className="h-4 w-4 text-purple-400" />
                      <span>{selectedVault.name}</span>
                      {selectedVault.item_count !== undefined && (
                        <span className="text-gray-400 text-sm">
                          ({selectedVault.item_count})
                        </span>
                      )}
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {vaults.map((vault) => (
                  <SelectItem key={vault.id} value={vault.id}>
                    <div className="flex items-center gap-3">
                      <Vault className="h-4 w-4 text-purple-400 flex-shrink-0" />
                      <span className="flex-1">{vault.name}</span>
                      {vault.item_count !== undefined && (
                        <span className="text-gray-400 text-xs">
                          {vault.item_count} {vault.item_count === 1 ? 'item' : 'items'}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="p-4 border border-dashed border-gray-600 rounded-md text-center bg-gray-800/20">
              <Vault className="h-8 w-8 text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No vaults yet</p>
              <p className="text-gray-500 text-xs">Create your first vault below</p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-gray-900 px-2 text-gray-500">or</span>
          </div>
        </div>

        {/* Create New Vault Button - Always Visible */}
        <Button
          variant="outline"
          className="w-full border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 hover:border-purple-500"
          onClick={() => setDialogStep('create')}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create New Vault
        </Button>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={handleAddToVault}
          disabled={isLoading || !selectedVaultId || isLoadingVaults}
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
      </DialogFooter>
    </>
  );

  const renderCreateStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 -ml-2"
            onClick={() => setDialogStep('select')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          Create New Vault
        </DialogTitle>
        <DialogDescription>
          Organize your collection with custom vaults.
        </DialogDescription>
      </DialogHeader>

      <div className="py-4">
        <Label htmlFor="new-vault-name">Vault Name</Label>
        <Input
          id="new-vault-name"
          value={newVaultName}
          onChange={(e) => setNewVaultName(e.target.value)}
          placeholder="e.g., Watches, Trading Cards, Sneakers"
          maxLength={100}
          autoFocus
          className="mt-1.5"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newVaultName.trim()) {
              handleCreateVault();
            }
          }}
        />
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => {
            setDialogStep('select');
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
            <>
              <Plus className="mr-2 h-4 w-4" />
              Create Vault
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );

  const renderSuccessStep = () => (
    <>
      <div className="py-8 text-center">
        <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-7 w-7 text-green-400" />
        </div>
        <h3 className="text-lg font-semibold mb-1">
          Item Secured!
        </h3>
        <p className="text-gray-400 text-sm">
          <span className="text-white">{analysisResult.itemName || 'Item'}</span>
          {' '}added to{' '}
          <span className="text-purple-400">{addedToVault?.name}</span>
        </p>
      </div>

      <DialogFooter className="sm:justify-center gap-2">
        <Button variant="outline" onClick={handleClose}>
          Done
        </Button>
        <Button onClick={() => navigate('/vault')}>
          <Vault className="mr-2 h-4 w-4" />
          View Vault
        </Button>
      </DialogFooter>
    </>
  );

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
        <DialogContent className="sm:max-w-[425px]">
          {dialogStep === 'select' && renderSelectStep()}
          {dialogStep === 'create' && renderCreateStep()}
          {dialogStep === 'success' && renderSuccessStep()}
        </DialogContent>
      </Dialog>
    </>
  );
};