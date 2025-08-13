import React, { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import SubCategoryModal from "../SubCategoryModal";

export default function RealEstateEntry() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card className="p-4 flex items-center justify-between">
        <div>
          <div className="font-semibold">Real Estate</div>
          <div className="text-xs opacity-70">Professional deal tools</div>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Open
        </Button>
      </Card>
      <SubCategoryModal
        open={open}
        onClose={() => setOpen(false)}
        category="Real Estate"
      />
    </>
  );
}
