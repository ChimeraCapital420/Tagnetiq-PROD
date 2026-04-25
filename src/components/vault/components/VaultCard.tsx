// FILE: src/components/vault/components/VaultCard.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Vault, DollarSign } from 'lucide-react';
import type { VaultType } from '../types';

interface VaultCardProps {
  vault: VaultType;
  onSelect: () => void;
}

export const VaultCard: React.FC<VaultCardProps> = ({ vault, onSelect }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-gray-800/50 backdrop-blur-sm p-4 md:p-6 rounded-lg cursor-pointer hover:bg-gray-800/70 transition-all touch-manipulation"
    onClick={onSelect}
  >
    <div className="flex items-start justify-between mb-4">
      <Vault className="h-6 w-6 md:h-8 md:w-8 text-purple-400" />
      <div className="text-right">
        <p className="text-xl md:text-2xl font-bold">{vault.item_count || 0}</p>
        <p className="text-xs md:text-sm text-gray-400">items</p>
      </div>
    </div>
    <h3 className="text-lg md:text-xl font-semibold mb-2 line-clamp-1">{vault.name}</h3>
    {vault.description && (
      <p className="text-xs md:text-sm text-gray-400 mb-3 line-clamp-2">{vault.description}</p>
    )}
    {vault.total_value !== undefined && vault.total_value > 0 && (
      <div className="flex items-center text-green-400">
        <DollarSign className="h-4 w-4 mr-1" />
        <span className="font-semibold">
          {vault.total_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </span>
      </div>
    )}
  </motion.div>
);