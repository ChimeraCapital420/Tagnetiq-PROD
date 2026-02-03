// FILE: src/components/marketplace/ExportListingModal.tsx
// Main modal with Ghost Protocol integration
// UPDATED: Passes ghost data through to listing form and API

import React, { useState } from 'react';
import { ExternalLink, Sparkles, Image as ImageIcon, Ghost, AlertTriangle } from 'lucide-react';
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
import type { GhostData } from '@/hooks/useGhostMode';

// Re-export types for backwards compatibility
export type { MarketplaceItem, FormattedListing, PlatformConfig } from './platforms/types';

interface ExportListingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MarketplaceItem;
  onListOnTagnetiq?: (
    item: MarketplaceItem, 
    price: number, 
    description: string,
    ghostData?: GhostData
  ) => Promise<void>;
  ghostData?: GhostData | null;  // NEW: Ghost data from analysis
}

export const ExportListingModal: React.FC<ExportListingModalProps> = ({
  open,
  onOpenChange,
  item,
  onListOnTagnetiq,
  ghostData = null,
}) => {
  const [activeTab, setActiveTab] = useState('tagnetiq');
  const [customDescription, setCustomDescription] = useState(item.description || '');

  const isGhostListing = !!ghostData?.is_ghost;

  const handleListOnTagnetiq = async (
    itemToList: MarketplaceItem,
    price: number,
    description: string,
    ghost?: GhostData
  ) => {
    if (onListOnTagnetiq) {
      await onListOnTagnetiq(itemToList, price, description, ghost || ghostData || undefined);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 bg-zinc-950 border-zinc-800 flex flex-col">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl flex items-center gap-2">
            {isGhostListing ? (
              <>
                <Ghost className="h-5 w-5 text-purple-400" />
                Ghost List & Export
              </>
            ) : (
              <>
                <ExternalLink className="h-5 w-5 text-primary" />
                List & Export
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isGhostListing ? (
              <>Create a virtual listing for an item you don't own yet</>
            ) : (
              <>List on TagnetIQ & export to {PLATFORMS.length}+ marketplaces</>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Ghost Warning Banner */}
        {isGhostListing && ghostData && (
          <div className="mx-6 mb-2 flex items-start gap-3 px-4 py-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
            <Ghost className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-purple-300">Ghost Protocol Active</p>
              <p className="text-xs text-purple-400/80 mt-0.5">
                Found at <strong>{ghostData.store.name}</strong> for ${ghostData.store.shelf_price.toFixed(2)}.
                {' '}Est. profit: <strong className="text-emerald-400">${ghostData.kpis.estimated_margin.toFixed(2)}</strong>
              </p>
            </div>
            <Badge 
              variant="outline" 
              className="border-purple-500/50 text-purple-400 text-[10px] flex-shrink-0"
            >
              {ghostData.timer.handling_hours}hr
            </Badge>
          </div>
        )}

        {/* Item Preview */}
        <div className="px-6 py-3 border-y border-zinc-800/50 bg-zinc-900/30">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0 relative">
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
              {isGhostListing && (
                <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                  <Ghost className="h-6 w-6 text-purple-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate text-sm">{item.item_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-primary font-bold">
                  ${item.asking_price.toLocaleString()}
                </span>
                {isGhostListing && (
                  <Badge
                    variant="secondary"
                    className="bg-purple-500/20 text-purple-400 border-0 text-[10px]"
                  >
                    <Ghost className="h-2.5 w-2.5 mr-1" />
                    Ghost
                  </Badge>
                )}
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
                className={`flex-1 text-sm data-[state=active]:text-primary-foreground ${
                  isGhostListing 
                    ? 'data-[state=active]:bg-purple-600' 
                    : 'data-[state=active]:bg-primary'
                }`}
              >
                {isGhostListing ? (
                  <>
                    <Ghost className="h-4 w-4 mr-2" />
                    Ghost List
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    TagnetIQ
                  </>
                )}
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
              ghostData={ghostData}
            />
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="flex-1 flex flex-col min-h-0 p-0">
            {isGhostListing && (
              <div className="mx-6 mt-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-400">
                  <strong>Ghost Mode:</strong> External platforms will show{' '}
                  <strong>{ghostData?.timer.handling_hours || 48}hr handling time</strong>.
                  Make sure you can retrieve the item before it sells!
                </p>
              </div>
            )}
            <PlatformExportTab
              item={item}
              customDescription={customDescription}
              onDescriptionChange={setCustomDescription}
              handlingTimeHours={ghostData?.timer.handling_hours}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ExportListingModal;