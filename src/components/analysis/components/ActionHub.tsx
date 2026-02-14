// FILE: src/components/analysis/components/ActionHub.tsx
// Fallback ACTION HUB — shown when Nexus data is not available or dismissed.
// Contains: AddToVault, ListOnMarketplace, Share, Clear, Delete (history view).

import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AddToVaultButton } from '@/components/vault/AddToVaultButton.js';
import { ListOnMarketplaceButton } from '@/components/marketplace/ListOnMarketplaceButton.js';
import type { MarketplaceItem } from '@/components/marketplace/platforms/types';
import type { GhostData } from '@/hooks/useGhostMode';

interface ActionHubProps {
  analysisResult: any;
  marketplaceItem: MarketplaceItem;
  ghostData: GhostData | null;
  isViewingHistory: boolean;
  onClear: () => void;
  onDeleteFromHistory: () => void;
  onListOnTagnetiq: (
    item: MarketplaceItem,
    price: number,
    description: string,
    ghost?: GhostData,
  ) => Promise<void>;
}

const ActionHub: React.FC<ActionHubProps> = ({
  analysisResult,
  marketplaceItem,
  ghostData,
  isViewingHistory,
  onClear,
  onDeleteFromHistory,
  onListOnTagnetiq,
}) => {
  return (
    <div className="w-full p-4 border rounded-lg bg-background">
      <h3 className="text-sm font-semibold mb-3 text-center text-muted-foreground">
        ACTION HUB
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {!isViewingHistory ? (
          <>
            <AddToVaultButton analysisResult={analysisResult} onSuccess={onClear} />
            <ListOnMarketplaceButton
              item={marketplaceItem}
              ghostData={ghostData}
              onListOnTagnetiq={onListOnTagnetiq}
            />
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => toast.info('Social sharing coming soon!')}
            >
              Share to Social
            </Button>
            <Button variant="outline" onClick={onClear} className="w-full">
              Clear & Scan Next
            </Button>
          </>
        ) : (
          <>
            <AddToVaultButton analysisResult={analysisResult} />
            <Button
              variant="destructive"
              className="w-full col-span-1"
              onClick={onDeleteFromHistory}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default ActionHub;