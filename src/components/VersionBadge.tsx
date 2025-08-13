import React from "react";
export default function VersionBadge({ version = "V9.0.2 Beta" }: { version?: string }) {
  return (
    <div className="fixed left-2 top-2 z-50">
      <div className="text-[11px] px-2 py-1 rounded-md bg-black/60 text-white/90 border border-white/10 tracking-wider">
        {version}
      </div>
    </div>
  );
}