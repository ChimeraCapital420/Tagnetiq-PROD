// FILE: src/components/vault/VaultSelectionBar.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  DollarSign,
  Trash2,
  X,
  CheckSquare,
  Settings2,
  Package
} from 'lucide-react';
import { VaultItem } from '@/pages/Vault';

interface VaultSelectionBarProps {
  selectedItems: VaultItem[];
  totalItems: number;
  onClearSelection: () => void;
  onSelectAll: () => void;
  onOpenManageModal: () => void;
}

export const VaultSelectionBar: React.FC<VaultSelectionBarProps> = ({
  selectedItems,
  totalItems,
  onClearSelection,
  onSelectAll,
  onOpenManageModal,
}) => {
  const totalValue = selectedItems.reduce((sum, item) => {
    const val = item.valuation_data?.estimatedValue;
    if (val) {
      const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
      return sum + (isNaN(num) ? 0 : num);
    }
    return sum;
  }, 0);

  const isAllSelected = selectedItems.length === totalItems;

  return (
    <AnimatePresence>
      {selectedItems.length > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-background/95 backdrop-blur-xl border-2 border-primary/20 rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4">
            {/* Selection count */}
            <div className="flex items-center gap-2">
              <Badge className="text-sm px-3 py-1 bg-primary">
                {selectedItems.length} selected
              </Badge>
              {totalValue > 0 && (
                <span className="text-sm text-green-500 font-medium">
                  ${totalValue.toLocaleString()}
                </span>
              )}
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Select all / deselect */}
            <Button
              variant="ghost"
              size="sm"
              onClick={isAllSelected ? onClearSelection : onSelectAll}
              className="gap-2"
            >
              <CheckSquare className="h-4 w-4" />
              {isAllSelected ? 'Deselect' : `All (${totalItems})`}
            </Button>

            <div className="h-6 w-px bg-border" />

            {/* Main action button */}
            <Button
              onClick={onOpenManageModal}
              className="gap-2"
            >
              <Package className="h-4 w-4" />
              Manage Items
            </Button>

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearSelection}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VaultSelectionBar;