// FILE: src/components/vault/AddToVaultButton.tsx

import React, { useState } from 'react';
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
    // CHARON: Initiate a loading toast and store its ID.
    // This provides immediate feedback that the process has started.
    const toastId = toast.loading('Securing item in Digital Vault...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const payload = {
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

      // CHARON: Update the toast to a success state using its ID.
      toast.success(`${payload.asset_name} has been secured.`, {
        id: toastId,
        action: {
          label: 'View Vault',
          onClick: () => navigate('/vault'),
        },
      });

      onSuccess(); // Clear the result from the parent component

    } catch (error: any) {
      // CHARON: Update the toast to an error state using its ID.
      toast.error("Failed to secure item", {
        id: toastId,
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleAddToVault} disabled={isLoading} size="lg" className="w-full mt-4">
      {isLoading ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      ) : (
        <ShieldCheck className="mr-2 h-5 w-5" />
      )}
      Secure in Vault
    </Button>
  );
};