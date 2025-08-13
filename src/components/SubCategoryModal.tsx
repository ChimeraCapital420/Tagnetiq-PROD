import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";

type Props = { open: boolean; onClose: () => void; category: string | null; };

const realEstateSubs = [
  { key: "wholesale", label: "Wholesale Deals" },
  { key: "fsbo", label: "For Sale By Owner (FSBO)" },
  { key: "comps", label: "Market Comps (Zillow/Redfin style)" },
  { key: "skiptrace", label: "Skip Trace (owner info)" },
  { key: "probate", label: "Probate Leads" },
  { key: "hedgebuyers", label: "Hedge Fund Buyers" },
];

export default function SubCategoryModal({ open, onClose, category }: Props) {
  const { toast } = useToast();
  if (!open || !category) return null;
  const items = category === "Real Estate" ? realEstateSubs : [];

  const onPick = (item: { key: string; label: string }) => {
    const gated = item.key === "skiptrace" || item.key === "probate";
    if (gated) {
      toast({ title: "Restricted", description: "This tool is hidden until compliance is verified for your location.", variant: "destructive" });
      return;
    }
    toast({ title: "AI primed", description: `AI primed for ${item.label}.` });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{category} � Tools</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((it) => (
            <button key={it.key} onClick={() => onPick(it)} className="text-left rounded-xl border border-border/60 bg-background/70 hover:bg-accent/30 transition p-4">
              <div className="font-medium">{it.label}</div>
              <div className="text-xs opacity-70">Tap to arm AI for this workflow</div>
            </button>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}