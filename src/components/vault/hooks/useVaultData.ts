// FILE: src/components/vault/hooks/useVaultData.ts
// All react-query data fetching for vaults and vault items.
// Touch data fetching here ONLY — never in Vault.tsx.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { VaultType, VaultItem } from '../types';

export function useVaultData(isVaultAccessible: boolean) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultDescription, setNewVaultDescription] = useState('');
  const [selectedVault, setSelectedVault] = useState<VaultType | null>(null);

  // ── Fetch all vaults ────────────────────────────────────────────────────
  const {
    data: vaults,
    isLoading: isVaultsLoading,
    error: vaultsError,
  } = useQuery<VaultType[], Error>({
    queryKey: ['vaults'],
    queryFn: async () => {
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch('/api/vault', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch vaults');
      return res.json();
    },
    enabled: !!session?.access_token && isVaultAccessible,
  });

  // ── Fetch items for selected vault ──────────────────────────────────────
  const {
    data: vaultItems,
    isLoading: isItemsLoading,
  } = useQuery<VaultItem[], Error>({
    queryKey: ['vaultItems', selectedVault?.id],
    queryFn: async () => {
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(`/api/vault/items?vaultId=${selectedVault!.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch items');
      return res.json();
    },
    enabled: !!session?.access_token && isVaultAccessible && !!selectedVault,
  });

  // ── Create vault mutation ───────────────────────────────────────────────
  const createVaultMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create vault');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vaults'] });
      toast.success('Vault created successfully');
      setNewVaultName('');
      setNewVaultDescription('');
    },
    onError: (err: Error) => toast.error('Failed to create vault', { description: err.message }),
  });

  const handleCreateVault = (onClose: () => void) => {
    if (!newVaultName.trim()) { toast.error('Vault name is required'); return; }
    createVaultMutation.mutate(
      { name: newVaultName.trim(), description: newVaultDescription.trim() },
      { onSuccess: onClose }
    );
  };

  // ── Update item in cache ────────────────────────────────────────────────
  const handleUpdateItem = (updatedItem: VaultItem) => {
    queryClient.setQueryData(
      ['vaultItems', selectedVault?.id],
      (old: VaultItem[] | undefined) =>
        old?.map(item => (item.id === updatedItem.id ? updatedItem : item))
    );
    toast.success('Vault item updated successfully.');
  };

  return {
    vaults, isVaultsLoading, vaultsError,
    vaultItems, isItemsLoading,
    selectedVault, setSelectedVault,
    newVaultName, setNewVaultName,
    newVaultDescription, setNewVaultDescription,
    createVaultMutation,
    handleCreateVault,
    handleUpdateItem,
  };
}