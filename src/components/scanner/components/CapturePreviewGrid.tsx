// FILE: src/components/scanner/components/CapturePreviewGrid.tsx
// Grid display for captured items with selection

import React from 'react';
import { Check, Trash2, ImageIcon, Video, FileText, Award, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/image-storage';
import type { CapturedItem } from '../hooks/useCapturedItems';

// =============================================================================
// TYPES
// =============================================================================

interface CapturePreviewGridProps {
  items: CapturedItem[];
  onToggleSelection: (id: string) => void;
  onRemove: (id: string) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CapturePreviewGrid: React.FC<CapturePreviewGridProps> = ({
  items,
  onToggleSelection,
  onRemove,
}) => {
  const getItemIcon = (item: CapturedItem) => {
    switch (item.type) {
      case 'photo':
        return <ImageIcon className="w-3 h-3" />;
      case 'video':
        return <Video className="w-3 h-3" />;
      case 'document':
        if (item.metadata?.documentType === 'certificate') return <Award className="w-3 h-3" />;
        if (item.metadata?.documentType === 'authenticity') return <ShieldCheck className="w-3 h-3" />;
        return <FileText className="w-3 h-3" />;
      default:
        return <FileText className="w-3 h-3" />;
    }
  };

  if (items.length === 0) return null;

  return (
    <div 
      className="captured-previews"
      style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxHeight: '5rem',
        overflowY: 'auto',
        padding: '0.5rem',
      }}
    >
      {items.map((item) => (
        <div key={item.id} className="relative group" style={{ position: 'relative' }}>
          {/* Thumbnail */}
          <img
            src={item.storedImage.thumbnailData}
            alt={item.name}
            className={`cursor-pointer transition-all border-2 ${
              item.selected
                ? 'border-blue-500 ring-2 ring-blue-300 scale-105'
                : 'border-gray-300 opacity-70 hover:opacity-100'
            }`}
            style={{
              width: '60px',
              height: '60px',
              objectFit: 'cover',
              borderRadius: '8px',
            }}
            onClick={() => onToggleSelection(item.id)}
            title={`${item.name} (${item.type}) - Original: ${formatFileSize(item.storedImage.originalSize)}`}
          />

          {/* Selection indicator */}
          {item.selected && (
            <div
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                backgroundColor: '#3b82f6',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid white',
                zIndex: 10,
              }}
            >
              <Check className="w-3 h-3 text-white" />
            </div>
          )}

          {/* Type indicator */}
          <div
            style={{
              position: 'absolute',
              bottom: '2px',
              left: '2px',
              backgroundColor: 'rgba(0,0,0,0.8)',
              color: 'white',
              borderRadius: '4px',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {getItemIcon(item)}
          </div>

          {/* Barcode indicator */}
          {item.metadata?.barcodes && item.metadata.barcodes.length > 0 && (
            <div
              style={{
                position: 'absolute',
                bottom: '2px',
                right: '2px',
                backgroundColor: 'rgba(34,197,94,0.9)',
                color: 'white',
                borderRadius: '4px',
                padding: '2px',
                fontSize: '10px',
                fontWeight: 'bold',
              }}
            >
              {item.metadata.barcodes.length}
            </div>
          )}

          {/* Remove button */}
          <Button
            variant="ghost"
            size="icon"
            style={{
              position: 'absolute',
              top: '-2px',
              left: '-2px',
              width: '20px',
              height: '20px',
              backgroundColor: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              opacity: 0,
              border: '2px solid white',
              padding: '0',
              minWidth: '20px',
            }}
            className="group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.id);
            }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
    </div>
  );
};

export default CapturePreviewGrid;