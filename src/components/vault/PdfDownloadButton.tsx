// FILE: src/components/vault/PdfDownloadButton.tsx

import React from 'react';
import { usePDF } from '@react-pdf/renderer';
import { VaultPdfDossier } from './VaultPdfDossier';
import type { VaultItem } from '@/pages/Vault';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';

interface PdfDownloadButtonProps {
  items: VaultItem[];
}

export const PdfDownloadButton: React.FC<PdfDownloadButtonProps> = ({ items }) => {
  // The usePDF hook generates the PDF document in the background.
  const [instance, updateInstance] = usePDF({
    document: <VaultPdfDossier items={items} />,
  });

  const handleDownload = () => {
    if (instance.url && !instance.loading) {
      const link = document.createElement('a');
      link.href = instance.url;
      const fileName = `Tagnetiq_Aegis_Dossier_${new Date().toISOString().split('T')[0]}.pdf`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Button onClick={handleDownload} disabled={items.length === 0 || instance.loading}>
      {instance.loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="mr-2 h-4 w-4" />
      )}
      Export Dossier (PDF)
    </Button>
  );
};
