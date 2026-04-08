// FILE: src/components/vault/components/SelectionScreen.tsx
import React from 'react';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Package, CheckSquare, CheckCircle2, MinusSquare,
  FileText, DollarSign, XCircle, AlertOctagon, Trash2,
  Search, X, Filter, Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VaultItem, ActionScreen } from '../types';
import { getStatusColor } from '../types';

interface SelectionScreenProps {
  items: VaultItem[];
  vaultName: string;
  filteredItems: VaultItem[];
  selectedItemIds: string[];
  totalValue: number;
  searchQuery: string;
  showInactiveItems: boolean;
  inactiveCount: number;
  onSearchChange: (q: string) => void;
  onShowInactiveChange: (v: boolean) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onSelectActiveOnly: () => void;
  onToggleItem: (id: string) => void;
  onNavigate: (screen: ActionScreen) => void;
}

export function SelectionScreen({
  vaultName,
  filteredItems,
  selectedItemIds,
  totalValue,
  searchQuery,
  showInactiveItems,
  inactiveCount,
  onSearchChange,
  onShowInactiveChange,
  onSelectAll,
  onSelectNone,
  onSelectActiveOnly,
  onToggleItem,
  onNavigate,
}: SelectionScreenProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Manage Vault Items
        </DialogTitle>
        <DialogDescription>
          Select items and choose an action. From vault: <span className="font-medium">{vaultName}</span>
        </DialogDescription>
      </DialogHeader>

      {/* Search and Filter Bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items by name, notes, or serial..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => onSearchChange('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={onSelectAll} className="h-8 text-xs">
              <CheckSquare className="h-3 w-3 mr-1" />All
            </Button>
            <Button variant="outline" size="sm" onClick={onSelectActiveOnly} className="h-8 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />Active
            </Button>
            <Button variant="ghost" size="sm" onClick={onSelectNone} className="h-8 text-xs">
              <MinusSquare className="h-3 w-3 mr-1" />None
            </Button>
          </div>
          {inactiveCount > 0 && (
            <div className="flex items-center gap-2">
              <Label htmlFor="show-inactive" className="text-xs text-muted-foreground cursor-pointer">
                Show inactive ({inactiveCount})
              </Label>
              <Switch
                id="show-inactive"
                checked={showInactiveItems}
                onCheckedChange={onShowInactiveChange}
              />
            </div>
          )}
        </div>
      </div>

      {/* Item List */}
      <div className="border rounded-lg">
        <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">{selectedItemIds.length}</span>
            <span className="text-muted-foreground">of {filteredItems.length} selected</span>
            {searchQuery && (
              <Badge variant="outline" className="text-xs">
                <Filter className="h-3 w-3 mr-1" />Filtered
              </Badge>
            )}
          </div>
          {totalValue > 0 && selectedItemIds.length > 0 && (
            <Badge variant="secondary" className="text-green-600">
              ${totalValue.toLocaleString()}
            </Badge>
          )}
        </div>

        <ScrollArea className="h-[220px] p-2">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <Package className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">
                {searchQuery ? 'No items match your search' : 'No items in vault'}
              </p>
              {searchQuery && (
                <Button variant="link" size="sm" onClick={() => onSearchChange('')}>
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item) => {
                const isSelected = selectedItemIds.includes(item.id);
                const isInactive = item.status && item.status !== 'active';
                return (
                  <div
                    key={item.id}
                    onClick={() => onToggleItem(item.id)}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border',
                      isSelected
                        ? 'bg-primary/10 border-primary/50 shadow-sm'
                        : 'hover:bg-muted/50 border-transparent',
                      isInactive && 'opacity-70'
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded flex items-center justify-center flex-shrink-0',
                      isSelected ? 'bg-primary text-primary-foreground' : 'border border-muted-foreground/30'
                    )}>
                      {isSelected && <CheckCircle2 className="h-3 w-3" />}
                    </div>
                    {item.photos?.[0] ? (
                      <img
                        src={item.photos[0]} alt=""
                        className={cn('w-10 h-10 object-cover rounded flex-shrink-0', isInactive && 'grayscale')}
                      />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate text-sm">{item.asset_name}</p>
                        {item.status && item.status !== 'active' && (
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 capitalize', getStatusColor(item.status))}>
                            {item.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.valuation_data?.estimatedValue ||
                          (item.owner_valuation ? `$${item.owner_valuation.toLocaleString()}` : 'No valuation')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      <Separator />

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { screen: 'export-pdf' as ActionScreen, Icon: FileText, color: 'blue', label: 'Export PDF' },
          { screen: 'mark-sold' as ActionScreen, Icon: DollarSign, color: 'green', label: 'Mark Sold' },
          { screen: 'mark-lost' as ActionScreen, Icon: XCircle, color: 'yellow', label: 'Mark Lost' },
          { screen: 'mark-damaged' as ActionScreen, Icon: AlertOctagon, color: 'orange', label: 'Mark Damaged' },
        ].map(({ screen, Icon, color, label }) => (
          <Button
            key={screen}
            variant="outline"
            className={`h-20 flex-col gap-1 hover:bg-${color}-500/10 hover:border-${color}-500 transition-colors`}
            onClick={() => onNavigate(screen)}
            disabled={selectedItemIds.length === 0}
          >
            <Icon className={`h-6 w-6 text-${color}-500`} />
            <span>{label}</span>
            {selectedItemIds.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {selectedItemIds.length} item{selectedItemIds.length !== 1 ? 's' : ''}
              </span>
            )}
          </Button>
        ))}
      </div>

      <Button
        variant="ghost"
        className="w-full text-red-500 hover:text-red-600 hover:bg-red-500/10"
        onClick={() => onNavigate('delete')}
        disabled={selectedItemIds.length === 0}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete Selected Items
      </Button>
    </>
  );
}