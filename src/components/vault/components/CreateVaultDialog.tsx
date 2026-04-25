// FILE: src/components/vault/components/CreateVaultDialog.tsx
// Create vault form — isolated from everything else.
// Change the vault creation form HERE without touching lobby or orchestrator.

import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface CreateVaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  description: string;
  isPending: boolean;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onSubmit: () => void;
}

export const CreateVaultDialog: React.FC<CreateVaultDialogProps> = ({
  open, onOpenChange, name, description, isPending,
  onNameChange, onDescriptionChange, onSubmit,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-[95vw] sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Create New Vault</DialogTitle>
        <DialogDescription>Organize your collection with custom vaults.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label htmlFor="vault-name">Vault Name</Label>
          <Input
            id="vault-name"
            value={name}
            onChange={e => onNameChange(e.target.value)}
            placeholder="e.g., Luxury Watches, Sports Memorabilia"
            maxLength={100}
          />
        </div>
        <div>
          <Label htmlFor="vault-description">Description (Optional)</Label>
          <Textarea
            id="vault-description"
            value={description}
            onChange={e => onDescriptionChange(e.target.value)}
            placeholder="Describe what this vault will contain..."
            maxLength={500}
            rows={3}
          />
        </div>
      </div>
      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Cancel</Button>
        <Button onClick={onSubmit} disabled={isPending} className="w-full sm:w-auto">
          {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Create Vault'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);