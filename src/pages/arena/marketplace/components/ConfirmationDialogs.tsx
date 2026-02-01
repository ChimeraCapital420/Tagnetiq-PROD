// FILE: src/pages/arena/marketplace/components/ConfirmationDialogs.tsx
// Confirmation dialogs for mark sold and delete

import React from 'react';
import { CheckCircle2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { MarketplaceItem, DialogState } from '../types';

interface MarkSoldDialogProps {
  dialog: DialogState<MarketplaceItem>;
  onClose: () => void;
  onConfirm: () => void;
}

export const MarkSoldDialog: React.FC<MarkSoldDialogProps> = ({
  dialog,
  onClose,
  onConfirm,
}) => {
  return (
    <AlertDialog open={dialog.open} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="bg-zinc-900 border-zinc-800">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">Mark as Sold?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark "{dialog.item?.item_name}" as sold. You can still see it in your listings with "Show sold" enabled.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-zinc-700 hover:bg-zinc-800">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark as Sold
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

interface DeleteDialogProps {
  dialog: DialogState<MarketplaceItem>;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteDialog: React.FC<DeleteDialogProps> = ({
  dialog,
  onClose,
  onConfirm,
}) => {
  return (
    <AlertDialog open={dialog.open} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="bg-zinc-900 border-zinc-800">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">Delete Listing?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove "{dialog.item?.item_name}" from the marketplace. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-zinc-700 hover:bg-zinc-800">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};