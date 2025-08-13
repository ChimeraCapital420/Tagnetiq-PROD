import React, { useState } from "react";
import SubCategoryModal from "./SubCategoryModal";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

export default function TrainableAICategories() {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const openModal = (category: string) => {
    setActiveCategory(category);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        <Card className="p-4 rounded-xl border border-border/60 bg-background/60 hover:bg-accent/30 transition">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Real Estate</div>
              <div className="text-xs opacity-70">
                Wholesale, FSBO, Comps & more
              </div>
            </div>
            <Button size="sm" onClick={() => openModal("Real Estate")}>
              Open
            </Button>
          </div>
        </Card>

        {/* Your existing tiles continue to render below via your current app */}
      </div>

      <SubCategoryModal
        open={open}
        onClose={() => setOpen(false)}
        category={activeCategory}
      />
    </div>
  );
}
