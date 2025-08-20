// FILE: src/components/vault/VaultItemCard.tsx

import React from 'react';
import type { VaultItem } from '@/pages/Vault';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Swords } from 'lucide-react';

interface VaultItemCardProps {
  item: VaultItem;
  onSelect: () => void;
  onStartChallenge: () => void;
}

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
    <Card onClick={onSelect} className="cursor-pointer hover:border-primary transition-all group flex flex-col h-full relative">
      <CardHeader className="p-0 relative">
        <div className="aspect-square w-full overflow-hidden rounded-t-lg relative">
          <img 
              src={item.photos?.[0] || '/placeholder.svg'} 
              alt={item.asset_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
          />
          <div 
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleChallengeClick}
          >
            <Badge className="bg-primary hover:bg-primary/80 cursor-pointer">
              <Swords className="h-4 w-4 mr-2" />
              Start Challenge
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 flex flex-col flex-grow">
        <CardTitle className="text-base font-semibold truncate flex-grow">{item.asset_name}</CardTitle>
        <div className="mt-2">
          <p className="text-lg font-bold">{displayValue}</p>
          <Badge variant={item.owner_valuation ? "secondary" : "outline"} className="mt-2 text-xs">
            {valueSource}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};