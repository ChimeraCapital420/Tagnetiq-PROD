// FILE: src/components/vault/hooks/useVaultActions.ts
// All API calls: export PDF, mark sold, mark lost/damaged, delete

import { useState } from 'react';
import { toast } from 'sonner';
import type { VaultItem, PdfOptions, SaleDetails, IncidentDetails } from '../types';

const DEFAULT_PDF_OPTIONS: PdfOptions = {
  includePhotos: true,
  includeValuations: true,
  includeNotes: true,
  includeProvenance: true,
  format: 'detailed',
};

const DEFAULT_SALE_DETAILS: SaleDetails = {
  salePrice: '',
  saleDate: new Date().toISOString().split('T')[0],
  buyerInfo: '',
  platform: '',
  notes: '',
};

const DEFAULT_INCIDENT_DETAILS: IncidentDetails = {
  date: new Date().toISOString().split('T')[0],
  description: '',
  insuranceClaim: false,
  claimNumber: '',
  policeReport: false,
  reportNumber: '',
};

interface UseVaultActionsProps {
  selectedItems: VaultItem[];
  selectedItemIds: string[];
  vaultName: string;
  session: { access_token: string } | null;
  onSelectionChange: (ids: string[]) => void;
  onItemsUpdated: () => void;
  onClose: () => void;
}

export function useVaultActions({
  selectedItems,
  selectedItemIds,
  vaultName,
  session,
  onSelectionChange,
  onItemsUpdated,
  onClose,
}: UseVaultActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfOptions, setPdfOptions] = useState<PdfOptions>(DEFAULT_PDF_OPTIONS);
  const [saleDetails, setSaleDetails] = useState<SaleDetails>(DEFAULT_SALE_DETAILS);
  const [incidentDetails, setIncidentDetails] = useState<IncidentDetails>(DEFAULT_INCIDENT_DETAILS);

  const resetState = () => {
    setSaleDetails(DEFAULT_SALE_DETAILS);
    setIncidentDetails(DEFAULT_INCIDENT_DETAILS);
  };

  const handleExportPdf = async () => {
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item');
      return;
    }
    setIsProcessing(true);
    const toastId = toast.loading('Generating PDF report...');
    try {
      const response = await fetch('/api/vault/export-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ items: selectedItems, vaultName, options: pdfOptions }),
      });
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${vaultName.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`PDF exported with ${selectedItems.length} item(s)`, { id: toastId });
      resetState();
      onClose();
    } catch {
      toast.error('Failed to export PDF', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkSold = async () => {
    if (!saleDetails.salePrice) {
      toast.error('Please enter the sale price');
      return;
    }
    setIsProcessing(true);
    const toastId = toast.loading('Recording sale...');
    try {
      const response = await fetch('/api/vault/items/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ itemIds: selectedItemIds, status: 'sold', details: saleDetails }),
      });
      if (!response.ok) throw new Error('Failed to update items');
      toast.success(`${selectedItems.length} item(s) marked as sold`, { id: toastId });
      onItemsUpdated();
      resetState();
      onClose();
    } catch {
      toast.error('Failed to mark items as sold', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkLostOrDamaged = async (status: 'lost' | 'damaged') => {
    if (!incidentDetails.description) {
      toast.error('Please describe what happened');
      return;
    }
    setIsProcessing(true);
    const toastId = toast.loading(`Marking items as ${status}...`);
    try {
      const response = await fetch('/api/vault/items/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ itemIds: selectedItemIds, status, details: incidentDetails }),
      });
      if (!response.ok) throw new Error('Failed to update items');
      toast.success(`${selectedItems.length} item(s) marked as ${status}`, { id: toastId });
      onItemsUpdated();
      resetState();
      onClose();
    } catch {
      toast.error(`Failed to mark items as ${status}`, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    setIsProcessing(true);
    const toastId = toast.loading('Deleting items...');
    try {
      const response = await fetch('/api/vault/items/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ itemIds: selectedItemIds }),
      });
      if (!response.ok) throw new Error('Failed to delete items');
      toast.success(`${selectedItems.length} item(s) deleted`, { id: toastId });
      onSelectionChange([]);
      onItemsUpdated();
      resetState();
      onClose();
    } catch {
      toast.error('Failed to delete items', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    pdfOptions, setPdfOptions,
    saleDetails, setSaleDetails,
    incidentDetails, setIncidentDetails,
    handleExportPdf,
    handleMarkSold,
    handleMarkLostOrDamaged,
    handleDelete,
    resetState,
  };
}