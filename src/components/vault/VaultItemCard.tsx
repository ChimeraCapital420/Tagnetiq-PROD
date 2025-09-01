import React from 'react';
import type { VaultItem } from '@/pages/Vault';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Swords } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button'; // Import the Button component

interface VaultItemCardProps {
  item: VaultItem;
  onSelect: () => void;
  onStartChallenge: () => void;
}

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
      <Card
        className="cursor-pointer bg-black/20 backdrop-blur-lg border border-white/10 hover:border-primary transition-all group flex flex-col h-full relative overflow-hidden"
      >
        <CardHeader className="p-0 relative" onClick={onSelect}>
          <div className="aspect-square w-full overflow-hidden relative">
            <img
              src={item.photos?.[0] || '/placeholder.svg'}
              alt={item.asset_name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-4 flex flex-col flex-grow">
          <CardTitle onClick={onSelect} className="text-base font-semibold truncate flex-grow text-gray-100">{item.asset_name}</CardTitle>
          <div className="mt-2" onClick={onSelect}>
            <p className="text-lg font-bold text-white">{displayValue}</p>
            <Badge variant={item.owner_valuation ? "secondary" : "outline"} className="mt-2 text-xs border-white/20 text-gray-300">
              {valueSource}
            </Badge>
          </div>
          {/* ACTIONABLE FIX: The "Start Challenge" is now a prominent, always-visible button */}
          <Button onClick={handleChallengeClick} className="w-full mt-4 bg-primary hover:bg-primary/80">
            <Swords className="h-4 w-4 mr-2" />
            Start Challenge
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};
