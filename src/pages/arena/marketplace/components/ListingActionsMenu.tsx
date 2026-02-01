// FILE: src/pages/arena/marketplace/components/ListingActionsMenu.tsx
// Owner actions dropdown menu for listings

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MoreVertical, CheckCircle2, Edit, Trash2, RefreshCw 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MarketplaceItem } from '../types';

interface ListingActionsMenuProps {
  item: MarketplaceItem;
  onMarkSold: () => void;
  onDelete: () => void;
  variant?: 'icon' | 'full';
}

export const ListingActionsMenu: React.FC<ListingActionsMenuProps> = ({ 
  item, 
  onMarkSold, 
  onDelete,
  variant = 'icon'
}) => {
  const navigate = useNavigate();
  
  const handleEdit = () => {
    navigate(`/arena/edit/${item.id}`);
  };

  const handleRelist = () => {
    // TODO: Implement relist functionality
    navigate(`/arena/edit/${item.id}?relist=true`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="secondary" 
          size="sm" 
          className={
            variant === 'icon' 
              ? 'h-8 w-8 p-0 bg-white/10 hover:bg-white/20'
              : 'h-8 gap-1.5 bg-white/10 hover:bg-white/20'
          }
          onClick={(e) => e.preventDefault()}
        >
          <MoreVertical className="h-4 w-4" />
          {variant === 'full' && <span>Actions</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {item.status === 'active' && (
          <>
            <DropdownMenuItem 
              onClick={(e) => {
                e.preventDefault();
                onMarkSold();
              }} 
              className="text-emerald-400 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark as Sold
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => {
                e.preventDefault();
                handleEdit();
              }}
              className="cursor-pointer"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Listing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {item.status === 'sold' && (
          <>
            <DropdownMenuItem 
              onClick={(e) => {
                e.preventDefault();
                handleRelist();
              }}
              className="cursor-pointer"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Relist Item
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem 
          onClick={(e) => {
            e.preventDefault();
            onDelete();
          }} 
          className="text-red-400 cursor-pointer"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Listing
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Quick action buttons for mobile / always visible
interface QuickActionsProps {
  item: MarketplaceItem;
  onMarkSold: () => void;
  onDelete: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  item,
  onMarkSold,
  onDelete,
}) => {
  if (item.status !== 'active') return null;
  
  return (
    <div className="flex gap-1">
      <Button
        variant="secondary"
        size="sm"
        className="h-7 px-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400"
        onClick={(e) => {
          e.preventDefault();
          onMarkSold();
        }}
      >
        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
        Sold
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="h-7 w-7 p-0 bg-red-500/20 hover:bg-red-500/30 text-red-400"
        onClick={(e) => {
          e.preventDefault();
          onDelete();
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};