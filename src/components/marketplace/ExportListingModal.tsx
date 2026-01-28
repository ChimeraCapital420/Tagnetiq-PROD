// FILE: src/components/marketplace/ExportListingModal.tsx
// Main modal - thin orchestrator that composes the form and export tabs
// Refactored from 1129-line monolith to clean modular architecture

import React, { useState } from 'react';
import { ExternalLink, Sparkles, Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

import { TagnetiqListingForm } from './TagnetiqListingForm';
import { PlatformExportTab } from './PlatformExportTab';
import { PLATFORMS } from './platforms';
import type { MarketplaceItem } from './platforms/types';

// Re-export types for backwards compatibility
export type { MarketplaceItem, FormattedListing, PlatformConfig } from './platforms/types';

interface ExportListingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MarketplaceItem;
  onListOnTagnetiq?: (item: MarketplaceItem, price: number, description: string) => Promise<void>;
}

export const ExportListingModal: React.FC<ExportListingModalProps> = ({
  open,
  onOpenChange,
  item,
  onListOnTagnetiq,
}) => {
  const [activeTab, setActiveTab] = useState('tagnetiq');
  const [customDescription, setCustomDescription] = useState(item.description || '');

  const handleListOnTagnetiq = async (
    itemToList: MarketplaceItem,
    price: number,
    description: string
  ) => {
    if (onListOnTagnetiq) {
      await onListOnTagnetiq(itemToList, price, description);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 bg-zinc-950 border-zinc-800 flex flex-col">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-primary" />
            List & Export
          </DialogTitle>
          <DialogDescription>
            List on TagnetIQ & export to {PLATFORMS.length}+ marketplaces with optimized formatting
          </DialogDescription>
        </DialogHeader>

        {/* Item Preview */}
        <div className="px-6 py-3 border-y border-zinc-800/50 bg-zinc-900/30">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
              {item.primary_photo_url ? (
                <img
                  src={item.primary_photo_url}
                  alt={item.item_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-zinc-600" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate text-sm">{item.item_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-primary font-bold">
                  ${item.asking_price.toLocaleString()}
                </span>
                {item.is_verified && (
                  <Badge
                    variant="secondary"
                    className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px]"
                  >
                    Verified
                  </Badge>
                )}
                {item.confidence_score && item.confidence_score > 0.8 && (
                  <Badge
                    variant="secondary"
                    className="bg-blue-500/20 text-blue-400 border-0 text-[10px]"
                  >
                    {Math.round(item.confidence_score * 100)}% confident
                  </Badge>
                )}
              </div>
              {item.authoritySource && (
                <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Data from {item.authoritySource}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-6 pt-2">
            <TabsList className="w-full bg-zinc-900/50 p-1">
              <TabsTrigger
                value="tagnetiq"
                className="flex-1 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                TagnetIQ
              </TabsTrigger>
              <TabsTrigger
                value="export"
                className="flex-1 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Export ({PLATFORMS.length} platforms)
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TagnetIQ Tab */}
          <TabsContent value="tagnetiq" className="flex-1 p-6 pt-4 overflow-y-auto">
            <TagnetiqListingForm
              item={item}
              onSubmit={handleListOnTagnetiq}
              disabled={!onListOnTagnetiq}
            />
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="flex-1 flex flex-col min-h-0 p-0">
            <PlatformExportTab
              item={item}
              customDescription={customDescription}
              onDescriptionChange={setCustomDescription}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ExportListingModal;
