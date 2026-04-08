// FILE: src/components/vault/components/DeleteScreen.tsx
import React from 'react';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Trash2, XCircle, ArrowLeft, Loader2 } from 'lucide-react';
import type { VaultItem } from '../types';

interface DeleteScreenProps {
  selectedItems: VaultItem[];
  totalValue: number;
  isProcessing: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export function DeleteScreen({
  selectedItems,
  totalValue,
  isProcessing,
  onConfirm,
  onBack,
}: DeleteScreenProps) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <Trash2 className="h-5 w-5" />
              Delete Items
            </DialogTitle>
            <DialogDescription>
              Permanently remove {selectedItems.length} item(s) from your vault
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <p className="font-medium text-red-500">This cannot be undone</p>
              <p className="text-sm text-muted-foreground">
                All photos, valuations, and documents will be permanently deleted.
                Consider marking items as "Sold" or "Lost" instead.
              </p>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[150px] border rounded-lg p-2">
          {selectedItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2 py-1 text-sm">
              <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span className="truncate flex-1">{item.asset_name}</span>
              {(item.valuation_data?.estimatedValue || item.owner_valuation) && (
                <span className="text-muted-foreground text-xs">
                  {item.valuation_data?.estimatedValue ||
                    `$${item.owner_valuation?.toLocaleString()}`}
                </span>
              )}
            </div>
          ))}
        </ScrollArea>

        {totalValue > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Total value being deleted:{' '}
            <span className="text-red-500 font-medium">${totalValue.toLocaleString()}</span>
          </p>
        )}
      </div>

      <Button onClick={onConfirm} disabled={isProcessing} variant="destructive" className="w-full">
        {isProcessing
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</>
          : <><Trash2 className="mr-2 h-4 w-4" />Delete {selectedItems.length} Item(s) Permanently</>
        }
      </Button>
    </>
  );
}