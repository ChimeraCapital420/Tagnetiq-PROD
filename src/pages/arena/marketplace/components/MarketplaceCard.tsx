// FILE: src/pages/arena/marketplace/components/MarketplaceCard.tsx
// Individual marketplace listing card

import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { 
  ShieldCheck, Heart, HeartOff, Eye, User,
  CheckCircle2, Trash2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { PriceFairnessIndicator } from './PriceFairnessIndicator';
import { StatusBadge } from './StatusBadge';
import { ListingActionsMenu, QuickActions } from './ListingActionsMenu';
import { ExportDropdown } from './ExportDropdown';
import { formatTimeAgo, getCategoryLabel } from '../utils/helpers';
import type { MarketplaceItem, LayoutMode } from '../types';

interface MarketplaceCardProps {
  item: MarketplaceItem;
  layout: LayoutMode;
  isOwner: boolean;
  isWatchlisted: boolean;
  onWatchlist: (id: string) => void;
  onExport: (item: MarketplaceItem, platform: string) => void;
  onMarkSold: (item: MarketplaceItem) => void;
  onDelete: (item: MarketplaceItem) => void;
}

export const MarketplaceCard: React.FC<MarketplaceCardProps> = ({ 
  item, 
  layout, 
  isOwner, 
  isWatchlisted,
  onWatchlist, 
  onExport, 
  onMarkSold, 
  onDelete,
}) => {
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  
  const timeAgo = useMemo(() => {
    return formatTimeAgo(item.created_at || item.listed_at);
  }, [item.created_at, item.listed_at]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 80;
    if (info.offset.x < -threshold && isOwner && item.status === 'active') {
      onMarkSold(item);
    } else if (info.offset.x > threshold && isOwner) {
      onDelete(item);
    }
    setSwipeOffset(0);
  };

  const isSold = item.status === 'sold';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      drag={isOwner ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDrag={(_, info) => setSwipeOffset(info.offset.x)}
      onDragEnd={handleDragEnd}
      style={{ x: swipeOffset }}
      className="relative"
    >
      {/* Swipe indicators (mobile) */}
      {isOwner && (
        <>
          <div className={cn(
            'absolute inset-y-0 left-0 w-20 flex items-center justify-center rounded-l-xl transition-opacity',
            'bg-red-500/80',
            swipeOffset > 40 ? 'opacity-100' : 'opacity-0'
          )}>
            <Trash2 className="h-6 w-6 text-white" />
          </div>
          <div className={cn(
            'absolute inset-y-0 right-0 w-20 flex items-center justify-center rounded-r-xl transition-opacity',
            'bg-emerald-500/80',
            swipeOffset < -40 ? 'opacity-100' : 'opacity-0'
          )}>
            <CheckCircle2 className="h-6 w-6 text-white" />
          </div>
        </>
      )}
      
      <Link to={`/arena/challenge/${item.challenge_id}`}>
        <Card className={cn(
          'group relative overflow-hidden transition-all duration-300',
          'bg-gradient-to-b from-zinc-900/50 to-zinc-950/80',
          'border-zinc-800/50 hover:border-zinc-700/80',
          'hover:shadow-xl hover:shadow-black/20',
          layout === 'compact' && 'flex flex-row h-32',
          isSold && 'opacity-75'
        )}>
          {/* Image */}
          <div className={cn(
            'relative overflow-hidden bg-zinc-900',
            layout === 'grid' ? 'aspect-square' : 'w-32 h-32 flex-shrink-0'
          )}>
            {!imageLoaded && <Skeleton className="absolute inset-0" />}
            <img
              src={item.primary_photo_url || '/placeholder.svg'}
              alt={item.item_name}
              onLoad={() => setImageLoaded(true)}
              className={cn(
                'w-full h-full object-cover transition-transform duration-500',
                'group-hover:scale-110',
                !imageLoaded && 'opacity-0',
                isSold && 'grayscale'
              )}
            />
            
            {/* Sold overlay */}
            {isSold && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Badge className="bg-emerald-500 text-white text-lg px-4 py-1">
                  SOLD
                </Badge>
              </div>
            )}
            
            {/* Top badges */}
            <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
              <div className="flex flex-col gap-1.5">
                {item.is_verified && (
                  <Badge className="bg-emerald-500/90 text-white border-0 shadow-lg">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
                <StatusBadge status={item.status || 'active'} />
                {!isSold && (
                  <PriceFairnessIndicator 
                    askingPrice={item.asking_price} 
                    estimatedValue={item.estimated_value}
                  />
                )}
              </div>
              
              {isOwner && (
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                  <User className="h-3 w-3 mr-1" />
                  Yours
                </Badge>
              )}
            </div>
            
            {/* Hover actions (desktop) */}
            <AnimatePresence>
              {isHovered && layout === 'grid' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-2 left-2 right-2 flex gap-2"
                  onClick={(e) => e.preventDefault()}
                >
                  {isOwner ? (
                    <>
                      <QuickActions 
                        item={item}
                        onMarkSold={() => onMarkSold(item)}
                        onDelete={() => onDelete(item)}
                      />
                      <ListingActionsMenu
                        item={item}
                        onMarkSold={() => onMarkSold(item)}
                        onDelete={() => onDelete(item)}
                      />
                    </>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 h-8 bg-white/10 backdrop-blur-sm hover:bg-white/20"
                      onClick={(e) => {
                        e.preventDefault();
                        onWatchlist(item.id);
                      }}
                    >
                      {isWatchlisted ? (
                        <HeartOff className="h-3.5 w-3.5 mr-1.5" />
                      ) : (
                        <Heart className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {isWatchlisted ? 'Remove' : 'Watch'}
                    </Button>
                  )}
                  {!isOwner && <ExportDropdown item={item} onExport={onExport} />}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Content */}
          <CardContent className={cn(
            'flex flex-col',
            layout === 'grid' ? 'p-4' : 'p-3 flex-1 justify-center'
          )}>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {item.category && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-zinc-800/50">
                  {getCategoryLabel(item.category)}
                </Badge>
              )}
              {timeAgo && (
                <span className="text-[10px] text-zinc-500">{timeAgo}</span>
              )}
            </div>
            
            <h3 className={cn(
              'font-semibold text-zinc-100 leading-tight',
              layout === 'grid' ? 'text-sm line-clamp-2 mb-2' : 'text-sm line-clamp-1 mb-1'
            )}>
              {item.item_name}
            </h3>
            
            <div className="flex items-baseline gap-2 mt-auto">
              <span className={cn(
                'text-lg font-bold',
                isSold ? 'text-emerald-400' : 'text-white'
              )}>
                ${(isSold ? item.sold_price || item.asking_price : item.asking_price).toLocaleString()}
              </span>
              {isSold && item.sold_price !== item.asking_price && (
                <span className="text-xs text-zinc-500 line-through">
                  ${item.asking_price.toLocaleString()}
                </span>
              )}
            </div>
            
            {/* Footer info */}
            {layout === 'grid' && (
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                  {item.seller_name && !isOwner && (
                    <span className="flex items-center gap-1 truncate">
                      <User className="h-3 w-3" />
                      {item.seller_name}
                    </span>
                  )}
                  {item.views !== undefined && item.views > 0 && (
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {item.views}
                    </span>
                  )}
                </div>
                
                {/* Always visible quick actions for owners */}
                {isOwner && item.status === 'active' && (
                  <div className="flex gap-1" onClick={(e) => e.preventDefault()}>
                    <QuickActions 
                      item={item}
                      onMarkSold={() => onMarkSold(item)}
                      onDelete={() => onDelete(item)}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
};