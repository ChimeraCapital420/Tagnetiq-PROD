// FILE: src/pages/Vault.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useMfa } from '@/contexts/MfaContext';
import { VaultItemCard } from '@/components/vault/VaultItemCard';
import { ItemDetailModal } from '@/components/vault/ItemDetailModal';
import { PdfDownloadButton } from '@/components/vault/PdfDownloadButton'; // Import the new button
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

const VaultPage: React.FC = () => {
  const { isMfaEnrolled, isVaultUnlocked, isLoading: isMfaLoading, checkMfaStatus, unlockVault } = useMfa();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);

  useEffect(() => {
    const fetchVaultItems = async () => {
      if (!isVaultUnlocked) {
        // Set loading to false if the vault is locked, as we are not fetching.
        setLoadingItems(false);
        return;
      };

      setLoadingItems(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const response = await fetch('/api/vault', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });

        if (!response.ok) throw new Error("Failed to fetch vault items.");
        
        const data = await response.json();
        setItems(data);
      } catch (error: any) {
        toast.error("Error Loading Vault", { description: error.message });
      } finally {
        setLoadingItems(false);
      }
    };

    fetchVaultItems();
  }, [isVaultUnlocked]);
  
  const handleItemUpdate = (updatedItem: VaultItem) => {
    setItems(prevItems => prevItems.map(item => item.id === updatedItem.id ? updatedItem : item));
    toast.success(`${updatedItem.asset_name} has been updated.`);
  };

  if (isMfaLoading) {
    return (
      <div className="container mx-auto p-8 text-center flex flex-col items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Verifying security status...</p>
      </div>
    );
  }

  if (!isMfaEnrolled) {
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
                <MfaSetup onSuccess={checkMfaStatus} />
            </CardContent>
        </Card>
      </div>
    );
  }

  if (!isVaultUnlocked) {
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

  // Render the actual vault content if unlocked
  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Digital Vault</h1>
          <p className="text-muted-foreground">Your secure inventory of valued assets.</p>
        </div>
        {/* --- INTEGRATE THE NEW BUTTON --- */}
        <PdfDownloadButton items={items} />
      </div>

      {loadingItems ? (
         <div className="text-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <h3 className="text-xl font-semibold">Your Vault is Empty</h3>
          <p className="text-muted-foreground mt-2">Add items from your analysis history to begin building your inventory.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {items.map(item => (
            <VaultItemCard key={item.id} item={item} onSelect={() => setSelectedItem(item)} />
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
    </div>
  );
};

export default VaultPage;
