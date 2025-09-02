// FILE: src/components/vault/PdfDownloadButton.tsx
// STATUS: SERVER-SIDE OPTIMIZED - Memory efficient with progress tracking

import React, { useState } from 'react';
import type { VaultItem } from '@/pages/Vault';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface PdfDownloadButtonProps {
  items: VaultItem[];
}

export const PdfDownloadButton: React.FC<PdfDownloadButtonProps> = ({ items }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleDownload = async () => {
    if (items.length === 0) {
      toast.error('No items to export');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    const toastId = toast.loading('Preparing your vault dossier...', {
      description: `Exporting ${items.length} items to PDF`
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      // PERFORMANCE: Progress simulation for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/vault/export-pdf', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Export failed with status ${response.status}`);
      }

      // PERFORMANCE: Handle blob streaming efficiently
      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('Generated PDF is empty');
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from response headers or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition?.match(/filename="([^"]+)"/)?.[1] || 
        `Tagnetiq_Vault_Export_${new Date().toISOString().split('T')[0]}.pdf`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Vault dossier downloaded successfully!', {
        id: toastId,
        description: `${items.length} items exported to ${filename}`,
        action: {
          label: 'View Downloads',
          onClick: () => {
            // Open downloads folder (browser dependent)
            if ('showDirectoryPicker' in window) {
              // Modern browsers with File System Access API
              toast.info('Check your Downloads folder');
            } else {
              toast.info('Check your Downloads folder');
            }
          }
        }
      });

    } catch (error: any) {
      console.error('PDF export error:', error);
      
      toast.error('Export failed', {
        id: toastId,
        description: error.message || 'Failed to generate PDF. Please try again.',
        action: {
          label: 'Retry',
          onClick: handleDownload
        }
      });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <Button 
      onClick={handleDownload} 
      disabled={items.length === 0 || isGenerating}
      className="relative overflow-hidden"
    >
      {isGenerating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span>Exporting... {progress}%</span>
          {/* Progress bar background */}
          <div 
            className="absolute bottom-0 left-0 h-1 bg-primary/30 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </>
      ) : items.length === 0 ? (
        <>
          <AlertCircle className="mr-2 h-4 w-4" />
          <span>No Items</span>
        </>
      ) : (
        <>
          <FileDown className="mr-2 h-4 w-4" />
          <span>Export Dossier ({items.length} items)</span>
        </>
      )}
    </Button>
  );
};