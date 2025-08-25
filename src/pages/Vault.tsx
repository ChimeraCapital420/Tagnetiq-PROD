// FILE: src/pages/Vault.tsx

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMfa } from '../contexts/MfaContext';
import { useQuery } from 'react-query';
import { supabase } from '../lib/supabase';
import { MfaSetup } from '../components/mfa/MfaSetup';
import { MfaUnlock } from '../components/mfa/MfaUnlock';
import { VaultItemCard } from '../components/vault/VaultItemCard';
import { PdfDownloadButton } from '../components/vault/PdfDownloadButton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldAlert } from 'lucide-react';
import { VaultItem } from '@/lib/supabase';

const VaultPage: React.FC = () => {
  const { profile, loading: authLoading, session } = useAuth();
  const { isUnlocked, unlockVault } = useMfa();

  const fetchVaultItems = async (): Promise<VaultItem[]> => {
    if (!session?.access_token) {
      throw new Error('Authentication token not found.');
    }

    const { data, error } = await supabase
      .from('vault_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }
    return data || [];
  };

  const { data: vaultItems, isLoading: isVaultLoading, isError, error } = useQuery<VaultItem[], Error>(
    'vaultItems',
    fetchVaultItems,
    {
      enabled: !!session?.access_token && isUnlocked,
    }
  );

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
    return <MfaSetup />;
  }

  if (profile.mfa_enrolled && !isUnlocked) {
    return <MfaUnlock onSuccess={unlockVault} />;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-4xl font-bold">Digital Vault</h1>
            {vaultItems && vaultItems.length > 0 && <PdfDownloadButton items={vaultItems} profile={profile} />}
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
                    <VaultItemCard key={item.id} item={item} />
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
  );
};

export default VaultPage;