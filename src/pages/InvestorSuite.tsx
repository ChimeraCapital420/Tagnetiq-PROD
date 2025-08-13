import React from "react";

export default function InvestorSuite() {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Investor Suite</h1>
      <p className="opacity-80">
        Premium metrics, projections, and materials live here. (Admin only)
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border">TAM / SAM / SOM</div>
        <div className="p-4 rounded-xl border">Growth Projections</div>
        <div className="p-4 rounded-xl border">Unit Economics</div>
        <div className="p-4 rounded-xl border">Pitch Materials</div>
      </div>
    </div>
  );
}
