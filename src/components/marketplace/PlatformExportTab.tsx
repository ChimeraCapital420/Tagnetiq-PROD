// FILE: src/components/marketplace/PlatformExportTab.tsx
// Export tab with platform selection and batch operations

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, ExternalLink, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import { PlatformCard } from './PlatformCard';
import { PLATFORMS, PLATFORM_CATEGORIES } from './platforms';
import type { MarketplaceItem, FormattedListing } from './platforms/types';

interface PlatformExportTabProps {
  item: MarketplaceItem;
  customDescription: string;
  onDescriptionChange: (desc: string) => void;
}

export const PlatformExportTab: React.FC<PlatformExportTabProps> = ({
  item,
  customDescription,
  onDescriptionChange,
}) => {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [copiedPlatforms, setCopiedPlatforms] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['general']));

  // Generate formatted listings for all platforms
  const formattedListings = useMemo(() => {
    const listings: Record<string, FormattedListing> = {};
    PLATFORMS.forEach((platform) => {
      listings[platform.id] = platform.formatter(item, customDescription);
    });
    return listings;
  }, [item, customDescription]);

  // Toggle platform selection
  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platformId)) {
        next.delete(platformId);
      } else {
        next.add(platformId);
      }
      return next;
    });
  };

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Copy single listing
  const copyListing = async (platformId: string) => {
    const platform = PLATFORMS.find((p) => p.id === platformId);
    const listing = formattedListings[platformId];
    if (!platform || !listing) return;

    const textToCopy = `${listing.title}\n\nPrice: $${listing.price}\n\n${listing.description}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedPlatforms((prev) => new Set(prev).add(platformId));
      toast.success(`${platform.name} listing copied!`);
      setTimeout(() => {
        setCopiedPlatforms((prev) => {
          const next = new Set(prev);
          next.delete(platformId);
          return next;
        });
      }, 3000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  // Open platform
  const openPlatform = (platformId: string) => {
    const platform = PLATFORMS.find((p) => p.id === platformId);
    if (platform) window.open(platform.listingUrl, '_blank');
  };

  // Copy all selected
  const copyAllSelected = async () => {
    if (selectedPlatforms.size === 0) {
      toast.error('Select at least one platform');
      return;
    }

    let allText = '';
    selectedPlatforms.forEach((platformId) => {
      const platform = PLATFORMS.find((p) => p.id === platformId);
      const listing = formattedListings[platformId];
      if (platform && listing) {
        allText += `\n${'═'.repeat(40)}\n${platform.name.toUpperCase()}\n${'═'.repeat(40)}\n\n`;
        allText += `TITLE:\n${listing.title}\n\nPRICE: $${listing.price}\n\nDESCRIPTION:\n${listing.description}\n\n`;
      }
    });

    await navigator.clipboard.writeText(allText.trim());
    toast.success(`${selectedPlatforms.size} listings copied!`);
  };

  // Open all selected
  const openAllSelected = () => {
    if (selectedPlatforms.size === 0) {
      toast.error('Select at least one platform');
      return;
    }
    selectedPlatforms.forEach((platformId) => {
      const platform = PLATFORMS.find((p) => p.id === platformId);
      if (platform) window.open(platform.listingUrl, '_blank');
    });
  };

  // Select all in category
  const selectAllInCategory = (categoryId: string) => {
    const categoryPlatforms = PLATFORMS.filter((p) => p.category === categoryId);
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      categoryPlatforms.forEach((p) => next.add(p.id));
      return next;
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Description customization */}
      <div className="px-6 py-3 border-b border-zinc-800/50">
        <Label className="text-xs text-zinc-400 mb-2 block">
          Custom description (applies to all platforms)
        </Label>
        <Textarea
          value={customDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="h-16 bg-zinc-900 border-zinc-800 resize-none text-sm"
          placeholder="Add description..."
        />
      </div>

      {/* Actions Bar */}
      {selectedPlatforms.size > 0 && (
        <div className="px-6 py-2 border-b border-zinc-800/50 bg-primary/5 flex items-center gap-2">
          <Badge variant="secondary" className="bg-primary/20 text-primary">
            {selectedPlatforms.size} selected
          </Badge>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-zinc-700"
            onClick={copyAllSelected}
          >
            <Copy className="h-3 w-3 mr-1" /> Copy All
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={openAllSelected}>
            <ExternalLink className="h-3 w-3 mr-1" /> Open All
          </Button>
        </div>
      )}

      {/* Platform List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {PLATFORM_CATEGORIES.map((category) => {
            const categoryPlatforms = PLATFORMS.filter((p) => p.category === category.id);
            const selectedCount = categoryPlatforms.filter((p) =>
              selectedPlatforms.has(p.id)
            ).length;
            const isExpanded = expandedCategories.has(category.id);

            return (
              <div key={category.id} className="space-y-2">
                {/* Category Header */}
                <div
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={() => toggleCategory(category.id)}
                >
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-zinc-500 transition-transform',
                      !isExpanded && '-rotate-90'
                    )}
                  />
                  <category.icon className="h-4 w-4 text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-300">
                    {category.label}
                  </span>
                  <Badge variant="outline" className="text-[10px] h-5 border-zinc-700">
                    {categoryPlatforms.length}
                  </Badge>
                  {selectedCount > 0 && (
                    <Badge className="text-[10px] h-5 bg-primary/20 text-primary border-0">
                      {selectedCount} selected
                    </Badge>
                  )}
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllInCategory(category.id);
                    }}
                  >
                    Select All
                  </Button>
                </div>

                {/* Category Platforms */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-6"
                    >
                      {categoryPlatforms.map((platform) => (
                        <PlatformCard
                          key={platform.id}
                          platform={platform}
                          selected={selectedPlatforms.has(platform.id)}
                          onToggle={() => togglePlatform(platform.id)}
                          copied={copiedPlatforms.has(platform.id)}
                          onCopy={() => copyListing(platform.id)}
                          onOpenPlatform={() => openPlatform(platform.id)}
                          listing={formattedListings[platform.id]}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Help Text */}
          <div className="bg-zinc-900/30 rounded-lg p-4 mt-4">
            <h4 className="text-xs font-medium text-zinc-400 mb-2">How to export:</h4>
            <ol className="text-[11px] text-zinc-500 space-y-1">
              <li>1. Select platforms you want to list on</li>
              <li>2. Click "Copy" to copy the pre-formatted listing</li>
              <li>3. Click "Open" to go to the platform's listing page</li>
              <li>4. Paste your listing and add photos</li>
            </ol>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default PlatformExportTab;