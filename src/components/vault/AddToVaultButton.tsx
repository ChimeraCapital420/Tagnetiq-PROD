// FILE: src/components/vault/AddToVaultButton.tsx

import React, { useState } from 'react'; // CORRECTED THIS LINE
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AddToVaultButtonProps {
  analysisResult: any; // The full result from the analysis API
  onSuccess: () => void; // Callback to clear the analysis result
}

export const AddToVaultButton: React.FC<AddToVaultButtonProps> = ({ analysisResult, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleAddToVault = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const payload = {
        asset_name: analysisResult.itemName || 'Untitled Asset',
        valuation_data: analysisResult,
        // Assuming the analysis result has an array of image URLs
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
      
      toast.success(`${payload.asset_name} secured in vault.`, {
        action: {
          label: 'View Vault',
          onClick: () => navigate('/vault'),
        },
      });

      onSuccess(); // Clear the result from the dashboard

    } catch (error: any) {
      toast.error("Error", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleAddToVault} disabled={isLoading} size="lg" className="w-full">
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <ShieldCheck className="mr-2 h-4 w-4" />
      )}
      Secure in Vault
    </Button>
  );
};
