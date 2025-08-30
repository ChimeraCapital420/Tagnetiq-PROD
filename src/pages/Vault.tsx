// FILE: src/pages/Vault.tsx
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMfa } from '../contexts/MfaContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { MfaSetup } from '../components/mfa/MfaSetup';
import { MfaUnlock } from '../components/mfa/MfaUnlock';
import { VaultItemCard } from '../components/vault/VaultItemCard';
import { PdfDownloadButton } from '../components/vault/PdfDownloadButton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldAlert } from 'lucide-react';
import { ItemDetailModal } from '@/components/vault/ItemDetailModal';
import ChallengeConfirmationModal from '@/components/arena/ChallengeConfirmationModal';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

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

// CHARON: A skeleton loader provides a better user experience than a simple spinner.
// It gives the user a preview of the content that is loading.
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

  const { data: vaultItems, isLoading: isVaultLoading, isError, error } = useQuery<VaultItem[], Error>({
    queryKey: ['vaultItems'],
    queryFn: fetchVaultItems,
    enabled: !!session?.access_token && isUnlocked,
  });

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
      <motion.div
        className="container mx-auto p-4 md:p-8"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold tracking-wider">Digital Vault</h1>
            {vaultItems && vaultItems.length > 0 && profile && <PdfDownloadButton items={vaultItems} profile={profile} />}
        </div>

        {isVaultLoading && <VaultSkeletonLoader />}

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
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            // CHARON: Container variant for staggering child animations.
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

        {!isVaultLoading && !isError && (!vaultItems || vaultItems.length === 0) && (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <h2 className="text-2xl font-semibold">Your Vault is Empty</h2>
            <p className="text-muted-foreground mt-2">Add items from the analysis page to secure them in your vault.</p>
          </div>
        )}
      </motion.div>

      {/* CHARON: AnimatePresence allows the modals to animate in and out gracefully. */}
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