// FILE: src/components/vault/types.ts
// All shared types for the VaultExportModal module

import type { VaultItem } from '@/pages/Vault';

export type { VaultItem };

export type ActionScreen = 'select' | 'export-pdf' | 'mark-sold' | 'mark-lost' | 'mark-damaged' | 'delete';

export interface VaultExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: VaultItem[];
  vaultName: string;
  selectedItemIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onItemsUpdated: () => void;
  session: { access_token: string } | null;
}

export interface PdfOptions {
  includePhotos: boolean;
  includeValuations: boolean;
  includeNotes: boolean;
  includeProvenance: boolean;
  format: 'detailed' | 'summary' | 'insurance';
}

export interface SaleDetails {
  salePrice: string;
  saleDate: string;
  buyerInfo: string;
  platform: string;
  notes: string;
}

export interface IncidentDetails {
  date: string;
  description: string;
  insuranceClaim: boolean;
  claimNumber: string;
  policeReport: boolean;
  reportNumber: string;
}

// Helper to get status color classes
export const getStatusColor = (status?: string): string => {
  switch (status) {
    case 'sold':    return 'bg-green-500/20 text-green-500 border-green-500/30';
    case 'lost':    return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
    case 'damaged': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
    case 'stolen':  return 'bg-red-500/20 text-red-500 border-red-500/30';
    default:        return '';
  }
};