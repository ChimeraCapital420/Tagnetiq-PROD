// FILE: src/pages/Vault.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { VaultItemCard } from '@/components/vault/VaultItemCard';
import { ItemDetailModal } from '@/components/vault/ItemDetailModal';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { toast } from 'sonner';

// Define the type for a vault item, including new fields
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
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);

  useEffect(() => {
    const fetchVaultItems = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const response = await fetch('/api/vault', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) throw new Error("Failed to fetch vault items.");
        
        const data = await response.json();
        setItems(data);
      } catch (error: any) {
        toast.error("Error Loading Vault", { description: error.message });
      } finally {
        setLoading(false);
      }
    };
    fetchVaultItems();
  }, []);
  
  const handleItemUpdate = (updatedItem: VaultItem) => {
    setItems(prevItems => prevItems.map(item => item.id === updatedItem.id ? updatedItem : item));
    toast.success(`${updatedItem.asset_name} has been updated.`);
  };

  if (loading) {
    return <div className="container mx-auto p-8 text-center">Loading your secure vault...</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Digital Vault</h1>
          <p className="text-muted-foreground">Your secure inventory of valued assets.</p>
        </div>
        <Button disabled={items.length === 0}>
          <FileDown className="mr-2 h-4 w-4" />
          Export Dossier (PDF)
        </Button>
      </div>

      {items.length === 0 ? (
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
