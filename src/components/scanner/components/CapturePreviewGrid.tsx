// FILE: src/components/scanner/components/CapturePreviewGrid.tsx
// Grid of captured item thumbnails with selection and delete

import React from 'react';
import { Check, Trash2, ImageIcon, Video, FileText, Award, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CapturedItem } from '../types';

interface CapturePreviewGridProps {
  items: CapturedItem[];
  onToggleSelection: (id: string) => void;
  onRemove: (id: string) => void;
}

export const CapturePreviewGrid: React.FC<CapturePreviewGridProps> = ({
  items,
  onToggleSelection,
  onRemove,
}) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="captured-previews flex gap-2 flex-wrap justify-center max-h-20 overflow-y-auto p-2">
      {items.map((item) => (
        <div key={item.id} className="relative group">
          <img
            src={item.thumbnail}
            alt={item.name}
            className={`cursor-pointer transition-all border-2 rounded-lg touch-manipulation ${
              item.selected 
                ? 'border-blue-500 ring-2 ring-blue-300 scale-105' 
                : 'border-gray-300 opacity-70'
            }`}
            style={{ width: '56px', height: '56px', objectFit: 'cover' }}
            onClick={() => onToggleSelection(item.id)}
          />
          
          {/* Selection indicator */}
          {item.selected && (
            <div className="absolute -top-0.5 -right-0.5 bg-blue-500 rounded-full w-5 h-5 flex items-center justify-center border-2 border-white z-10">
              <Check className="w-3 h-3 text-white" />
            </div>
          )}
          
          {/* Item type badge */}
          <div className="absolute bottom-0.5 left-0.5 bg-black/80 text-white rounded p-0.5">
            <ItemTypeIcon type={item.type} metadata={item.metadata} />
          </div>
          
          {/* Delete button (visible on hover) */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-0.5 -left-0.5 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity border-2 border-white p-0"
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

// Helper component for item type icons
const ItemTypeIcon: React.FC<{ type: string; metadata?: any }> = ({ type, metadata }) => {
  switch (type) {
    case 'photo':
      return <ImageIcon className="w-3 h-3" />;
    case 'video':
      return <Video className="w-3 h-3" />;
    case 'document':
      if (metadata?.documentType === 'certificate') return <Award className="w-3 h-3" />;
      if (metadata?.documentType === 'authenticity') return <ShieldCheck className="w-3 h-3" />;
      return <FileText className="w-3 h-3" />;
    default:
      return <FileText className="w-3 h-3" />;
  }
};

export default CapturePreviewGrid;