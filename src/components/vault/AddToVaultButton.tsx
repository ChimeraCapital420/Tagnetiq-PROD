// FILE: src/components/vault/AddToVaultButton.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ShieldCheck, Loader2, Plus, Vault, ChevronLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

  // Auto-select first vault if only one exists and none selected
  useEffect(() => {
    if (vaults && vaults.length === 1 && !selectedVaultId) {
      setSelectedVaultId(vaults[0].id);
    }
  }, [vaults, selectedVaultId]);

  // Reset dialog state when opened
  useEffect(() => {
    if (isDialogOpen) {
      setDialogStep('select');
      setAddedToVault(null);
      setNewVaultName('');
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
      setDialogStep('select');
      setNewVaultName('');
      toast.success(`Vault "${newVault.name}" created!`, {
        description: 'Now click "Add to Vault" to secure your item.',
      });
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
    setSelectedVaultId('');
    setDialogStep('select');
    setAddedToVault(null);
  };

  const renderSelectStep = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Vault className="h-5 w-5 text-purple-400" />
          Select Vault
        </DialogTitle>
        <DialogDescription>
          Choose which vault to store "{analysisResult.itemName || 'this item'}" in.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {isLoadingVaults ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            <span className="ml-2 text-gray-400">Loading your vaults...</span>
          </div>
        ) : vaultsError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load vaults: {vaultsError.message}
              <Button variant="link" className="p-0 h-auto ml-2" onClick={() => refetch()}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : vaults && vaults.length > 0 ? (
          <RadioGroup value={selectedVaultId} onValueChange={setSelectedVaultId} className="space-y-2">
            {vaults.map((vault) => (
              <div 
                key={vault.id} 
                className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                  selectedVaultId === vault.id 
                    ? 'border-purple-500 bg-purple-500/10' 
                    : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
                }`}
                onClick={() => setSelectedVaultId(vault.id)}
              >
                <RadioGroupItem value={vault.id} id={vault.id} />
                <Label htmlFor={vault.id} className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Vault className="h-4 w-4 text-purple-400" />
                      <span className="font-medium">{vault.name}</span>
                    </div>
                    {vault.item_count !== undefined && (
                      <span className="text-sm text-gray-400">
                        {vault.item_count} {vault.item_count === 1 ? 'item' : 'items'}
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
        ) : (
          <div className="text-center py-6 border-2 border-dashed border-gray-700 rounded-lg">
            <Vault className="mx-auto h-12 w-12 text-gray-500 mb-3" />
            <p className="text-gray-400 mb-2">You don't have any vaults yet</p>
            <p className="text-sm text-gray-500">Create your first vault to start securing items</p>
          </div>
        )}

        <Button
          variant="outline"
          className="w-full"
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
            className="h-8 w-8 mr-1"
            onClick={() => setDialogStep('select')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          Create New Vault
        </DialogTitle>
        <DialogDescription>
          Give your vault a name to organize your collection.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div>
          <Label htmlFor="new-vault-name">Vault Name</Label>
          <Input
            id="new-vault-name"
            value={newVaultName}
            onChange={(e) => setNewVaultName(e.target.value)}
            placeholder="e.g., Luxury Watches, Trading Cards"
            maxLength={100}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newVaultName.trim()) {
                handleCreateVault();
              }
            }}
          />
          <p className="text-xs text-gray-500 mt-1">
            You can organize items by category, theme, or any way you like.
          </p>
        </div>
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
          Back
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
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          Item Secured!
        </DialogTitle>
      </DialogHeader>

      <div className="py-6 text-center">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="h-8 w-8 text-green-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">
          {analysisResult.itemName || 'Item'} has been secured
        </h3>
        <p className="text-gray-400">
          Added to <span className="text-purple-400 font-medium">{addedToVault?.name}</span>
        </p>
      </div>

      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
          Continue Analyzing
        </Button>
        <Button onClick={() => navigate('/vault')} className="w-full sm:w-auto">
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
        <DialogContent className="sm:max-w-md">
          {dialogStep === 'select' && renderSelectStep()}
          {dialogStep === 'create' && renderCreateStep()}
          {dialogStep === 'success' && renderSuccessStep()}
        </DialogContent>
      </Dialog>
    </>
  );
};