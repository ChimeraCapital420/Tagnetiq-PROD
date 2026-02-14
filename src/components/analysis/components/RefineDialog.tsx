// FILE: src/components/analysis/components/RefineDialog.tsx
// Dialog for refining analysis with additional user context.

import React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface RefineDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  refinementText: string;
  onTextChange: (text: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}

const RefineDialog: React.FC<RefineDialogProps> = ({
  isOpen,
  onOpenChange,
  refinementText,
  onTextChange,
  isSubmitting,
  onSubmit,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refine AI Analysis</DialogTitle>
          <DialogDescription>
            Add new information that was missed by the visual scan, like an autograph, a flaw, or original packaging.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Label htmlFor="refinement-text">New Information:</Label>
          <Textarea
            id="refinement-text"
            placeholder="e.g., 'Autographed by the author on the inside cover.' or 'Has a 2-inch tear on the dust jacket.'"
            className="h-32"
            value={refinementText}
            onChange={(e) => onTextChange(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit & Re-Analyze
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RefineDialog;