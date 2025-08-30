// FILE: src/components/vault/VaultItemCard.tsx

import React from 'react';
import type { VaultItem } from '@/pages/Vault';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Swords } from 'lucide-react';
import { motion } from 'framer-motion';

interface VaultItemCardProps {
  item: VaultItem;
  onSelect: () => void;
  onStartChallenge: () => void;
}

// CHARON: Variants for the card's entry animation.
// This will be orchestrated by the parent motion.div in VaultPage.
const cardVariants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 },
};

export const VaultItemCard: React.FC<VaultItemCardProps> = ({ item, onSelect, onStartChallenge }) => {
  const displayValue = item.owner_valuation
    ? item.owner_valuation.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : item.valuation_data?.estimatedValue
      ? `$${parseFloat(item.valuation_data.estimatedValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'Valuation Pending';

  const valueSource = item.owner_valuation ? "Owner Valuation" : "AI Valuation";

  const handleChallengeClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the card's onSelect from firing
    onStartChallenge();
  };

  return (
    <motion.div variants={cardVariants} className="h-full">
        {/* CHARON: The card's styling has been updated for a futuristic "glassmorphism" effect.
            - bg-black/20: Semi-transparent black background.
            - backdrop-blur-lg: Blurs the content behind the card.
            - border-white/10: A subtle border to define the card's edges.
            - hover:scale-105: Provides a "lift" effect on hover for better feedback.
        */}
      <Card
        onClick={onSelect}
        className="cursor-pointer bg-black/20 backdrop-blur-lg border border-white/10 hover:border-primary transition-all group flex flex-col h-full relative overflow-hidden"
      >
        <CardHeader className="p-0 relative">
          <div className="aspect-square w-full overflow-hidden relative">
            <img
              src={item.photos?.[0] || '/placeholder.svg'}
              alt={item.asset_name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
            />
            <div
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              onClick={handleChallengeClick}
            >
              <Badge className="bg-primary hover:bg-primary/80 cursor-pointer shadow-lg">
                <Swords className="h-4 w-4 mr-2" />
                Start Challenge
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 flex flex-col flex-grow">
          <CardTitle className="text-base font-semibold truncate flex-grow text-gray-100">{item.asset_name}</CardTitle>
          <div className="mt-2">
            <p className="text-lg font-bold text-white">{displayValue}</p>
            <Badge variant={item.owner_valuation ? "secondary" : "outline"} className="mt-2 text-xs border-white/20 text-gray-300">
              {valueSource}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};