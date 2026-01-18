// FILE: src/components/vault/ItemDetailModal.tsx

// CHARON: Corrected the import statement below.
import React, { useState, useEffect } from 'react';
import type { VaultItem } from '@/pages/Vault';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Upload, FileText, Trash2, Loader2, ImageOff } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { QrCodeGenerator } from './QrCodeGenerator.js';
import { motion } from 'framer-motion';

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

        const { error: uploadError } = await supabase.storage
            .from('aegis-documents')
            .uploadToSignedUrl(path, token, file);

        if (uploadError) throw uploadError;

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
      <DialogContent
        as={motion.div}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-black/50 backdrop-blur-xl border border-white/10 text-white max-w-4xl p-0"
      >
        <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="p-6 border-r border-white/10 hidden md:block">
                <Carousel className="w-full">
                    <CarouselContent>
                        {item.photos && item.photos.length > 0 ? (
                            item.photos.map((photo, index) => (
                                <CarouselItem key={index}>
                                    <div className="aspect-square w-full overflow-hidden rounded-lg">
                                        <img src={photo} alt={`${item.asset_name} photo ${index + 1}`} className="w-full h-full object-cover"/>
                                    </div>
                                </CarouselItem>
                            ))
                        ) : (
                            <CarouselItem>
                                <div className="aspect-square w-full flex items-center justify-center bg-black/20 rounded-lg">
                                    <ImageOff className="h-16 w-16 text-gray-500"/>
                                </div>
                            </CarouselItem>
                        )}
                    </CarouselContent>
                    {item.photos && item.photos.length > 1 && (
                        <>
                            <CarouselPrevious className="left-2 bg-black/50 border-white/20 text-white hover:bg-white/20 hover:text-white" />
                            <CarouselNext className="right-2 bg-black/50 border-white/20 text-white hover:bg-white/20 hover:text-white" />
                        </>
                    )}
                </Carousel>
                {!isEditing && (
                    <div className="mt-6">
                         <QrCodeGenerator assetId={item.id} assetName={item.asset_name} />
                    </div>
                )}
            </div>

            <div className="flex flex-col">
                <DialogHeader className="p-6">
                  <DialogTitle className="text-2xl text-white">{item.asset_name}</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    AI Valuation: {aiValue} | Added on {new Date(item.created_at).toLocaleDateString()}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 px-6 pb-6 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-2">
                        <Label htmlFor="owner_valuation" className="text-gray-300">Owner's Valuation (USD)</Label>
                        <Input id="owner_valuation" type="number" placeholder="e.g., 1500.00"
                            value={formData.owner_valuation} onChange={handleInputChange} readOnly={!isEditing}
                            className="bg-white/5 border-white/20 focus-visible:ring-primary"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="serial_number" className="text-gray-300">Serial Number / VIN</Label>
                        <Input id="serial_number" value={formData.serial_number} onChange={handleInputChange} readOnly={!isEditing} placeholder="Enter serial number"
                            className="bg-white/5 border-white/20 focus-visible:ring-primary"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="notes" className="text-gray-300">Notes</Label>
                        <Textarea id="notes" value={formData.notes} onChange={handleInputChange} readOnly={!isEditing} placeholder="Add any relevant notes..."
                            className="bg-white/5 border-white/20 focus-visible:ring-primary min-h-[80px]"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-gray-300">Provenance Documents</Label>
                        <div
                            {...getRootProps()}
                            className={`p-4 border-2 border-dashed rounded-lg text-center transition-colors ${
                                isDragActive ? 'border-primary bg-primary/10' : 'border-white/20 hover:border-primary/50'
                            } ${!isEditing || isUploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        >
                            <input {...getInputProps()} />
                            {isUploading ? (
                                <div className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /><span>Uploading...</span></div>
                            ) : (
                                <div className="flex items-center justify-center gap-2"><Upload className="h-5 w-5" /><span>{isDragActive ? 'Drop file' : 'Drag, drop, or click'}</span></div>
                            )}
                        </div>
                         {documents.length > 0 && (
                            <div className="space-y-2 pt-2">
                                {documents.map((docPath) => (
                                    <div key={docPath} className="flex items-center justify-between p-2 rounded-md bg-white/5">
                                        <div className="flex items-center gap-2 truncate"><FileText className="h-4 w-4 flex-shrink-0" /><span className="text-sm truncate">{docPath.split('-').pop()}</span></div>
                                        {isEditing && (
                                            <Button variant="ghost" size="icon" className="h-6 w-6" disabled><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="mt-auto p-6 bg-black/20 border-t border-white/10 sm:justify-between">
                  {isEditing ? (
                    <div className="flex w-full justify-between">
                      <Button variant="ghost" onClick={() => setIsEditing(false)} className="text-gray-300 hover:bg-white/10 hover:text-white">Cancel</Button>
                      <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Saving...</> : 'Save Changes'}
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={() => setIsEditing(true)} className="w-full">Edit Details</Button>
                  )}
                </DialogFooter>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};