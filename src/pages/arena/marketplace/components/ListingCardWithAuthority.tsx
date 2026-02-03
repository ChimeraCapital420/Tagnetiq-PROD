// FILE: src/pages/arena/marketplace/components/ListingCardWithAuthority.tsx
// NEW: Listing card component that displays authority links
// This can replace or wrap your existing ListingCard component
// Mobile-first design with touch-friendly interactions

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, User, Sparkles, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AuthorityLinks } from '@/components/marketplace/AuthorityLinks';
import { ListingActionsMenu, QuickActions } from './ListingActionsMenu';
import type { MarketplaceItemWithAuthority } from '../types/authority';

interface ListingCardWithAuthorityProps {
  item: MarketplaceItemWithAuthority;
  isOwner?: boolean;
  onMarkSold?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
  className?: string;
}

export const ListingCardWithAuthority: React.FC<ListingCardWithAuthorityProps> = ({
  item,
  isOwner = false,
  onMarkSold,
  onDelete,
  onClick,
  className,
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/arena/marketplace/${item.id}`);
    }
  };

  // Format price
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(item.asking_price);

  // Format date
  const formattedDate = new Date(item.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card
      className={cn(
        'group overflow-hidden bg-zinc-900/50 border-zinc-800',
        'hover:border-zinc-700 transition-all cursor-pointer',
        'touch-manipulation',
        item.status === 'sold' && 'opacity-75',
        className
      )}
      onClick={handleClick}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-zinc-800">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.item_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600">
            No Image
          </div>
        )}
        
        {/* Status badge */}
        {item.status === 'sold' && (
          <Badge className="absolute top-2 left-2 bg-emerald-500 text-white">
            SOLD
          </Badge>
        )}
        
        {/* Price badge */}
        <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-md">
          <span className="text-white font-bold text-sm">{formattedPrice}</span>
        </div>
        
        {/* Owner actions */}
        {isOwner && onMarkSold && onDelete && (
          <div 
            className="absolute top-2 right-2"
            onClick={(e) => e.stopPropagation()}
          >
            <ListingActionsMenu
              item={item}
              onMarkSold={onMarkSold}
              onDelete={onDelete}
            />
          </div>
        )}
      </div>

      <CardContent className="p-3 space-y-2">
        {/* Title */}
        <h3 className="font-medium text-white text-sm line-clamp-2 min-h-[2.5rem]">
          {item.item_name}
        </h3>

        {/* FIXED: Authority links - preserved from analysis */}
        <AuthorityLinks 
          item={item} 
          variant="compact" 
          showLabels={false}
          className="py-1"
        />

        {/* Meta info */}
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          {item.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate max-w-[80px]">{item.location}</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formattedDate}
          </span>
        </div>

        {/* HYDRA confidence indicator */}
        {item.confidence_score && item.confidence_score > 0.8 && (
          <div className="flex items-center gap-1 text-[10px] text-primary">
            <Sparkles className="h-3 w-3" />
            <span>HYDRA Verified</span>
          </div>
        )}

        {/* Quick actions for owner on mobile */}
        {isOwner && onMarkSold && onDelete && (
          <div 
            className="pt-2 border-t border-zinc-800 sm:hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <QuickActions
              item={item}
              onMarkSold={onMarkSold}
              onDelete={onDelete}
            />
          </div>
        )}

        {/* Seller info (non-owner view) */}
        {!isOwner && item.seller && (
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
            {item.seller.avatar_url ? (
              <img
                src={item.seller.avatar_url}
                alt=""
                className="w-5 h-5 rounded-full"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center">
                <User className="h-3 w-3 text-zinc-400" />
              </div>
            )}
            <span className="text-xs text-zinc-400 truncate">
              {item.seller.username || 'Seller'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Grid container for listing cards - mobile-first responsive
export const ListingGrid: React.FC<{ 
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div className={cn(
    // Mobile: 2 columns
    // sm: 2 columns
    // md: 3 columns  
    // lg: 4 columns
    // xl: 5 columns
    'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
    'gap-3 sm:gap-4',
    className
  )}>
    {children}
  </div>
);

export default ListingCardWithAuthority;