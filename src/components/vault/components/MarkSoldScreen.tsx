// FILE: src/components/vault/components/MarkSoldScreen.tsx
import React from 'react';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ShoppingBag, DollarSign, ArrowLeft, Loader2 } from 'lucide-react';
import type { VaultItem, SaleDetails } from '../types';

interface MarkSoldScreenProps {
  selectedItems: VaultItem[];
  totalValue: number;
  saleDetails: SaleDetails;
  isProcessing: boolean;
  onSaleDetailsChange: (details: SaleDetails) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export function MarkSoldScreen({
  selectedItems,
  totalValue,
  saleDetails,
  isProcessing,
  onSaleDetailsChange,
  onConfirm,
  onBack,
}: MarkSoldScreenProps) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-green-500" />
              Mark as Sold
            </DialogTitle>
            <DialogDescription>
              Record sale details for {selectedItems.length} item(s)
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
        <div className="flex flex-wrap gap-1">
          {selectedItems.slice(0, 3).map(item => (
            <Badge key={item.id} variant="outline" className="text-xs border-green-500/30">
              {item.asset_name.length > 15 ? item.asset_name.substring(0, 15) + '...' : item.asset_name}
            </Badge>
          ))}
          {selectedItems.length > 3 && (
            <Badge variant="outline" className="text-xs">+{selectedItems.length - 3} more</Badge>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="salePrice">Sale Price *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="salePrice"
                type="number"
                placeholder="0.00"
                className="pl-9"
                value={saleDetails.salePrice}
                onChange={(e) => onSaleDetailsChange({ ...saleDetails, salePrice: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="saleDate">Sale Date</Label>
            <Input
              id="saleDate"
              type="date"
              value={saleDetails.saleDate}
              onChange={(e) => onSaleDetailsChange({ ...saleDetails, saleDate: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="buyerInfo">Buyer</Label>
            <Input
              id="buyerInfo"
              placeholder="Name or username"
              value={saleDetails.buyerInfo}
              onChange={(e) => onSaleDetailsChange({ ...saleDetails, buyerInfo: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform">Platform</Label>
            <Input
              id="platform"
              placeholder="eBay, StockX, etc."
              value={saleDetails.platform}
              onChange={(e) => onSaleDetailsChange({ ...saleDetails, platform: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="saleNotes">Notes</Label>
          <Textarea
            id="saleNotes"
            placeholder="Additional sale details..."
            value={saleDetails.notes}
            onChange={(e) => onSaleDetailsChange({ ...saleDetails, notes: e.target.value })}
            rows={2}
          />
        </div>

        {totalValue > 0 && saleDetails.salePrice && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span>Original Value:</span>
              <span>${totalValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Sale Price:</span>
              <span>${parseFloat(saleDetails.salePrice || '0').toLocaleString()}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-medium">
              <span>Profit/Loss:</span>
              <span className={parseFloat(saleDetails.salePrice) >= totalValue ? 'text-green-500' : 'text-red-500'}>
                {parseFloat(saleDetails.salePrice) >= totalValue ? '+' : ''}
                ${(parseFloat(saleDetails.salePrice || '0') - totalValue).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      <Button onClick={onConfirm} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-700">
        {isProcessing
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
          : <><DollarSign className="mr-2 h-4 w-4" />Confirm Sale</>
        }
      </Button>
    </>
  );
}