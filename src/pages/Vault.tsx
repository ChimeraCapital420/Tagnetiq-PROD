// FILE: src/pages/Vault.tsx

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useMfa } from '@/contexts/MfaContext';
import { VaultItemCard } from '@/components/vault/VaultItemCard';
import { ItemDetailModal } from '@/components/vault/ItemDetailModal';
import { PdfDownloadButton } from '@/components/vault/PdfDownloadButton';
import { ChallengeConfirmationModal } from '@/components/arena/ChallengeConfirmationModal';
import { Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MfaSetup } from '@/components/mfa/MfaSetup';
import { MfaUnlock } from '@/components/mfa/MfaUnlock';

// Define the type for a vault item
export interface VaultItem {
  id: string;
  asset_name: string;
  valuation_data: any;
  photos: string[];
  notes?: string;
  serial_number?: string;
  receipt_url?: string;
  owner_valuation?: number;
  provenance_documents?: string[];
  created_at: string;
}

const fetchVaultItems = async (accessToken: string | undefined) => {
    if (!accessToken) {
        throw new Error("Not authenticated");
    }
    const { data, error } = await supabase.from('vault_items').select('*');
    if (error) {
        throw new Error(error.message);
    }
    return data;
}

const VaultPage: React.FC = () => {
    const { profile, loading: authLoading, session } = useAuth();
    const { isUnlocked, unlockVault } = useMfa();

    const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
    const [challengeItem, setChallengeItem] = useState<VaultItem | null>(null);

    const { data: items, isLoading: isLoadingItems, error: itemsError } = useQuery<VaultItem[], Error>({
        queryKey: ['vaultItems'],
        queryFn: () => fetchVaultItems(session?.access_token),
        enabled: !!session?.access_token && isUnlocked,
    });

  const handleItemUpdate = (updatedItem: VaultItem) => {
    setSelectedItem(updatedItem)
    toast.success(`${updatedItem.asset_name} has been updated.`);
  };

  const handleConfirmChallenge = async (askingPrice: number) => {
    if (!challengeItem) return;

    toast.info(`Starting ROI Challenge for ${challengeItem.asset_name}...`);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch('/api/arena/challenge', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vault_item_id: challengeItem.id,
          asking_price: askingPrice,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to start challenge.');
      }

      toast.success("Challenge Started!", {
        description: `${challengeItem.asset_name} is now live in the Arena Marketplace.`,
      });
    } catch (error) {
      toast.error("Failed to Start Challenge", { description: (error as Error).message });
    } finally {
      setChallengeItem(null);
    }
  };

  if (authLoading) {
    return <div className="container mx-auto p-8 text-center">Loading Security Profile...</div>;
  }

  if (!profile) {
      return <div className="container mx-auto p-8 text-center">Error: User profile not found.</div>;
  }

  if (!profile.mfa_enrolled) {
    return (
      <div className="container mx-auto p-4 md:p-8 flex items-center justify-center h-[calc(100vh-8rem)]">
        <Card className="max-w-md w-full">
            <CardHeader className="text-center">
                <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                    <Shield className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="mt-4">Enable Vault Security</CardTitle>
                <CardDescription>
                    To protect your sensitive asset data, you must enable Multi-Factor Authentication (MFA).
                </CardDescription>
            </CardHeader>
            <CardContent>
                <MfaSetup onSuccess={() => {}} />
            </CardContent>
        </Card>
      </div>
    );
  }

  if (profile.mfa_enrolled && !isUnlocked) {
     return (
      <div className="container mx-auto p-4 md:p-8 flex items-center justify-center h-[calc(100vh-8rem)]">
        <Card className="max-w-sm w-full">
            <CardContent className="pt-6">
                <MfaUnlock onSuccess={unlockVault} />
            </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Digital Vault</h1>
          <p className="text-muted-foreground">Your secure inventory of valued assets.</p>
        </div>
        <PdfDownloadButton items={items || []} />
      </div>

      {isLoadingItems ? (
         <div className="text-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
      ) : itemsError ? (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <h3 className="text-xl font-semibold">Error Loading Vault</h3>
          <p className="text-muted-foreground mt-2">{itemsError.message}</p>
        </div>
      ) : items && items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <h3 className="text-xl font-semibold">Your Vault is Empty</h3>
          <p className="text-muted-foreground mt-2">Add items from your analysis history to begin building your inventory.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {items && items.map(item => (
            <VaultItemCard 
              key={item.id} 
              item={item} 
              onSelect={() => setSelectedItem(item)}
              onStartChallenge={() => setChallengeItem(item)}
            />
          ))}
        </div>
      )}

      {selectedItem && (
        <ItemDetailModal 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)}
          onUpdate={handleItemUpdate}
        />
      )}

      {challengeItem && (
        <ChallengeConfirmationModal
          item={challengeItem}
          isOpen={!!challengeItem}
          onClose={() => setChallengeItem(null)}
          onConfirm={handleConfirmChallenge}
        />
      )}
    </div>
  );
};

export default VaultPage;