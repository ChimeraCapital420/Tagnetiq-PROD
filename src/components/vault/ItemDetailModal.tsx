// FILE: src/components/vault/ItemDetailModal.tsx

import React, { useState, useEffect } from 'react';
import type { VaultItem } from '@/pages/Vault';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ItemDetailModalProps {
  item: VaultItem;
  onClose: () => void;
  onUpdate: (updatedItem: VaultItem) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item, onClose, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    notes: '',
    serial_number: '',
    owner_valuation: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Effect to reset form data when the selected item changes
  useEffect(() => {
    if (item) {
      setFormData({
        notes: item.notes || '',
        serial_number: item.serial_number || '',
        owner_valuation: item.owner_valuation?.toString() || '',
      });
      setIsEditing(false); // Reset to view mode when item changes
    }
  }, [item]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const updatePayload: any = {
            notes: formData.notes,
            serial_number: formData.serial_number,
        };

        // Only include owner_valuation if it's a valid number
        const valuation = parseFloat(formData.owner_valuation);
        if (!isNaN(valuation) && formData.owner_valuation.trim() !== '') {
            updatePayload.owner_valuation = valuation;
        } else {
            updatePayload.owner_valuation = null; // Set to null if empty or invalid
        }

        const response = await fetch(`/api/vault/items/${item.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatePayload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to save changes.");
        }

        const updatedItem = await response.json();
        onUpdate(updatedItem);
        setIsEditing(false);
        // Do not close modal on save, allow user to see changes
        toast.success(`${updatedItem.asset_name} has been updated.`);

    } catch (error: any) {
        toast.error("Save Failed", { description: error.message });
    } finally {
        setIsSaving(false);
    }
  };

  const aiValue = item.valuation_data?.estimatedValue 
    ? `$${parseFloat(item.valuation_data.estimatedValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'N/A';

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{item.asset_name}</DialogTitle>
          <DialogDescription>
            AI Valuation: {aiValue} | Added on {new Date(item.created_at).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="owner_valuation">Owner's Valuation (USD)</Label>
                <Input id="owner_valuation" type="number" placeholder="e.g., 1500.00"
                    value={formData.owner_valuation} onChange={handleInputChange} readOnly={!isEditing} />
                <p className="text-xs text-muted-foreground">Set this to override the AI valuation. Requires supporting documentation.</p>
            </div>
            <div className="space-y-2">
                <Label htmlFor="serial_number">Serial Number / VIN</Label>
                <Input id="serial_number" value={formData.serial_number} onChange={handleInputChange} readOnly={!isEditing} placeholder="Enter serial number" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={formData.notes} onChange={handleInputChange} readOnly={!isEditing} placeholder="Add any relevant notes..." />
            </div>
             <div className="space-y-2">
                <Label>Provenance Documents</Label>
                <Button variant="outline" disabled={!isEditing} className="w-full">Upload Appraisal or Receipt</Button>
            </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {isEditing ? (
            <div className="flex w-full justify-between">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="w-full">Edit Details</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
