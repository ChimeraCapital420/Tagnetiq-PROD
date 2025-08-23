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
import { Upload, FileText, Trash2, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { QrCodeGenerator } from './QrCodeGenerator';

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
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<string[]>([]);

  useEffect(() => {
    if (item) {
      setFormData({
        notes: item.notes || '',
        serial_number: item.serial_number || '',
        owner_valuation: item.owner_valuation?.toString() || '',
      });
      setDocuments(item.provenance_documents || []);
      setIsEditing(false);
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

        const valuation = parseFloat(formData.owner_valuation);
        if (!isNaN(valuation) && formData.owner_valuation.trim() !== '') {
            updatePayload.owner_valuation = valuation;
        } else {
            updatePayload.owner_valuation = null;
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
        toast.success(`${updatedItem.asset_name} has been updated.`);

    } catch (error: any) {
        toast.error("Save Failed", { description: error.message });
    } finally {
        setIsSaving(false);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    toast.info(`Uploading ${file.name}...`);

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        // 1. Get a signed URL from the secure endpoint
        const uploadUrlResponse = await fetch('/api/vault/documents/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fileName: file.name,
                fileType: file.type,
                itemId: item.id,
            }),
        });

        if (!uploadUrlResponse.ok) {
            const errorData = await uploadUrlResponse.json();
            throw new Error(errorData.error || 'Could not get secure upload link.');
        }
        const { token, path } = await uploadUrlResponse.json();

        // 2. Upload the file directly to Supabase Storage using the pre-signed URL
        const { error: uploadError } = await supabase.storage
            .from('aegis-documents')
            .uploadToSignedUrl(path, token, file);

        if (uploadError) throw uploadError;

        // 3. Update the vault item with the new document path
        const newDocuments = [...documents, path];
        const { data: updatedItem, error: dbError } = await supabase
            .from('vault_items')
            .update({ provenance_documents: newDocuments })
            .eq('id', item.id)
            .select()
            .single();

        if (dbError) throw dbError;

        setDocuments(newDocuments);
        onUpdate(updatedItem);
        toast.success(`${file.name} uploaded and linked successfully.`);

    } catch (error: any) {
        toast.error("Upload Failed", { description: error.message });
    } finally {
        setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: !isEditing || isUploading,
  });

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
        
        <div className="grid gap-6 py-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-2">
                <Label htmlFor="owner_valuation">Owner's Valuation (USD)</Label>
                <Input id="owner_valuation" type="number" placeholder="e.g., 1500.00"
                    value={formData.owner_valuation} onChange={handleInputChange} readOnly={!isEditing} />
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
                <div
                    {...getRootProps()}
                    className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                        isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    } ${!isEditing || isUploading ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                    <input {...getInputProps()} />
                    {isUploading ? (
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <span>Uploading...</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <Upload className="h-6 w-6" />
                            <p className="text-sm text-muted-foreground">
                                {isDragActive ? 'Drop the file here' : 'Drag & drop a file, or click to select'}
                            </p>
                        </div>
                    )}
                </div>
                {documents.length > 0 && (
                    <div className="space-y-2 mt-4">
                        {documents.map((docPath) => (
                            <div key={docPath} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                <div className="flex items-center gap-2 truncate">
                                    <FileText className="h-4 w-4 flex-shrink-0" />
                                    <span className="text-sm truncate">{docPath.split('-').pop()}</span>
                                </div>
                                {isEditing && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {!isEditing && (
              <QrCodeGenerator assetId={item.id} assetName={item.asset_name} />
            )}
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