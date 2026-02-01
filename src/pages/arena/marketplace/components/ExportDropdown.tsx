// FILE: src/pages/arena/marketplace/components/ExportDropdown.tsx
// Export listing to external platforms

import React from 'react';
import { ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { EXPORT_PLATFORMS } from '../constants';
import type { MarketplaceItem } from '../types';

interface ExportDropdownProps {
  item: MarketplaceItem;
  onExport: (item: MarketplaceItem, platform: string) => void;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({ item, onExport }) => {
  const handleCopyLink = () => {
    const link = `${window.location.origin}/arena/challenge/${item.challenge_id}`;
    const text = `${item.item_name} - $${item.asking_price}\n${link}`;
    navigator.clipboard.writeText(text);
    toast.success('Link copied to clipboard');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="secondary" 
          size="sm" 
          className="h-8 gap-1.5 bg-white/5 hover:bg-white/10 border-white/10"
          onClick={(e) => e.preventDefault()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Export Listing To
        </div>
        <DropdownMenuSeparator />
        {EXPORT_PLATFORMS.map((platform) => (
          <DropdownMenuItem 
            key={platform.id}
            onClick={(e) => {
              e.preventDefault();
              onExport(item, platform.id);
            }}
            className="gap-2 cursor-pointer"
          >
            <div className={cn('p-1 rounded', platform.color)}>
              <platform.icon className="h-3 w-3 text-white" />
            </div>
            {platform.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={(e) => {
            e.preventDefault();
            handleCopyLink();
          }}
          className="gap-2 cursor-pointer"
        >
          <Copy className="h-4 w-4" />
          Copy Link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};