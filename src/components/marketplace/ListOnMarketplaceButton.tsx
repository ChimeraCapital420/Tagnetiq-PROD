// FILE: src/components/marketplace/ListOnMarketplaceButton.tsx
// Button component that opens the ExportListingModal
// Used by AnalysisResult to trigger listing flow

import React, { useState } from 'react';
import { Store, Ghost } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportListingModal } from './ExportListingModal';
import type { MarketplaceItem } from './platforms/types';
import type { GhostData } from '@/hooks/useGhostMode';
import { cn } from '@/lib/utils';

interface ListOnMarketplaceButtonProps {
  item: MarketplaceItem;
  onListOnTagnetiq?: (
    item: MarketplaceItem,
    price: number,
    description: string,
    ghostData?: GhostData
  ) => Promise<void>;
  ghostData?: GhostData | null;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  disabled?: boolean;
}

export const ListOnMarketplaceButton: React.FC<ListOnMarketplaceButtonProps> = ({
  item,
  onListOnTagnetiq,
  ghostData = null,
  className,
  variant = 'default',
  size = 'default',
  disabled = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isGhost = !!ghostData?.is_ghost;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsModalOpen(true)}
        disabled={disabled}
        className={cn(
          isGhost && 'bg-purple-600 hover:bg-purple-700',
          className
        )}
      >
        {isGhost ? (
          <>
            <Ghost className="h-4 w-4 mr-2" />
            Ghost List
          </>
        ) : (
          <>
            <Store className="h-4 w-4 mr-2" />
            List & Export
          </>
        )}
      </Button>

      <ExportListingModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        item={item}
        onListOnTagnetiq={onListOnTagnetiq}
        ghostData={ghostData}
      />
    </>
  );
};

export default ListOnMarketplaceButton;