import React, { useEffect, useState } from "react";
import AdvancedSettingsModal from "./AdvancedSettingsModal";

/** Admin-only floating button to open Settings (safe to remove once nav settings is restored) */
export default function BetaAdminDock() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setIsAdmin(localStorage.getItem("tq_is_admin") === "1");
  }, []);
  if (!isAdmin) return null;
  return (
    <>
      <div style={{ position: "fixed", top: 12, right: 12, zIndex: 9998 }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #374151",
            background: "#111827",
            color: "#e5e7eb",
          }}
        >
          Settings
        </button>
      </div>
      {open && (
        <AdvancedSettingsModal isOpen={open} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
