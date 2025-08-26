// FILE: src/pages/Vault.tsx

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMfa } from '../contexts/MfaContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { MfaSetup } from '../components/mfa/MfaSetup';
import { MfaUnlock } from '../components/mfa/MfaUnlock';
import { VaultItemCard } from '../components/vault/VaultItemCard';
import { PdfDownloadButton } from '../components/vault/PdfDownloadButton';
// CORRECTED: This import now points to the file you created in Part 1.
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; 
import { Loader2, ShieldAlert } from 'lucide-react';
import { ItemDetailModal } from '@/components/vault/ItemDetailModal';
import { ChallengeConfirmationModal } from '@/components/arena/ChallengeConfirmationModal';
import { toast } from 'sonner';

// The VaultItem type MUST be defined and exported here,
// as all child components import it from this file.
export interface VaultItem {
  id: string;
  user_id: string;
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

const VaultPage: React.FC = () => {
  const { profile, loading: authLoading, session } = useAuth();
  const { isUnlocked, unlockVault } = useMfa();
  const queryClient = useQueryClient();

  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [itemToChallenge, setItemToChallenge] = useState<VaultItem | null>(null);

  const fetchVaultItems = async (): Promise<VaultItem[]> => {
    if (!session?.access_token) {
      throw new Error('Authentication token not found.');
    }
    const { data, error } = await supabase.from('vault_items').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  };

  const { data: vaultItems, isLoading: isVaultLoading, isError, error } = useQuery<VaultItem[], Error>(
    'vaultItems',
    fetchVaultItems,
    { enabled: !!session?.access_token && isUnlocked }
  );
  
  const handleConfirmChallenge = async (askingPrice: number) => {
    if (!itemToChallenge || !session) return;
    
    const toastId = toast.loading("Submitting item to the Arena...");
    try {
      const response = await fetch('/api/arena/challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ vault_item_id: itemToChallenge.id, asking_price: askingPrice }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start challenge.");
      }

      toast.success("Item successfully listed in the Arena!", { id: toastId });
      setItemToChallenge(null);
      queryClient.invalidateQueries({ queryKey: ['vaultItems'] });

    } catch (err) {
      toast.error("Failed to start challenge", { id: toastId, description: (err as Error).message });
    }
  };

  const handleUpdateItem = (updatedItem: VaultItem) => {
    queryClient.setQueryData(['vaultItems'], (oldData: VaultItem[] | undefined) =>
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

  return (
    <>
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold">Digital Vault</h1>
          {vaultItems && vaultItems.length > 0 && profile && <PdfDownloadButton items={vaultItems} profile={profile} />}
        </div>

        {isVaultLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            <span className="text-xl">Loading Vault Items...</span>
          </div>
        )}
        
        {isError && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Error Loading Vault</AlertTitle>
            <AlertDescription>
              There was a problem fetching your vault items. Please try again later.
              <p className="text-xs mt-2">{(error as Error)?.message}</p>
            </AlertDescription>
          </Alert>
        )}

        {!isVaultLoading && !isError && vaultItems && vaultItems.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {vaultItems.map((item) => (
              <VaultItemCard 
                key={item.id} 
                item={item} 
                onSelect={() => setSelectedItem(item)}
                onStartChallenge={() => setItemToChallenge(item)}
              />
            ))}
          </div>
        )}
        
        {!isVaultLoading && !isError && (!vaultItems || vaultItems.length === 0) && (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <h2 className="text-2xl font-semibold">Your Vault is Empty</h2>
            <p className="text-muted-foreground mt-2">Add items from the analysis page to secure them in your vault.</p>
          </div>
        )}
      </div>
      
      {selectedItem && (
        <ItemDetailModal 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)}
          onUpdate={handleUpdateItem}
        />
      )}
      
      {itemToChallenge && (
        <ChallengeConfirmationModal 
          isOpen={!!itemToChallenge}
          onClose={() => setItemToChallenge(null)}
          item={itemToChallenge}
          onConfirm={handleConfirmChallenge}
        />
      )}
    </>
  );
};

export default VaultPage;