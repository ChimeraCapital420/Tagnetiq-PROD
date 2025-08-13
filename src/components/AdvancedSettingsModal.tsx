import React, { useEffect, useState } from "react";

type Props = { isOpen?: boolean; onClose?: () => void };

function useIsAdmin() {
  try {
    // Replace with Supabase role check later. Local flag for now.
    const ls =
      typeof window !== "undefined" ? localStorage.getItem("tq_is_admin") : null;
    return ls === "1";
  } catch {
    return false;
  }
}

function BetaControls() {
  const [wmEnabled, setWmEnabled] = useState(false);
  const [wmOpacity, setWmOpacity] = useState(0.05);
  useEffect(() => {
    const en = localStorage.getItem("tq_wm_enabled");
    const op = localStorage.getItem("tq_wm_opacity");
    if (en !== null) setWmEnabled(en === "1");
    if (op !== null) setWmOpacity(Math.max(0, Math.min(0.2, parseFloat(op))));
  }, []);
  function save() {
    localStorage.setItem("tq_wm_enabled", wmEnabled ? "1" : "0");
    localStorage.setItem("tq_wm_opacity", String(wmOpacity));
    alert("Saved. Refreshing to apply watermark…");
    window.location.reload();
  }
  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="font-semibold mb-2">Beta Controls (Admin)</div>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span>Watermark</span>
          <input
            aria-label="Watermark enabled"
            type="checkbox"
            checked={wmEnabled}
            onChange={(e) => setWmEnabled(e.target.checked)}
          />
        </div>
        <div>
          <div className="mb-1">Watermark Opacity ({wmOpacity.toFixed(2)})</div>
          <input
            aria-label="Watermark opacity"
            type="range"
            min="0"
            max="0.2"
            step="0.01"
            value={wmOpacity}
            onChange={(e) => setWmOpacity(parseFloat(e.target.value))}
          />
        </div>
        <div className="pt-2 border-t border-white/10 text-sm">
          <a href="/auth/forgot" className="text-blue-400 hover:underline">
            Forgot Password
          </a>
        </div>
        <div>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              const btn = document.querySelector(
                'button[title*="Send Feedback"]'
              ) as HTMLButtonElement;
              if (btn) btn.click();
            }}
            className="text-blue-400 hover:underline"
          >
            Send Feedback
          </a>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={save}
          className="px-3 py-1 rounded-md bg-blue-600 text-white"
        >
          Save
        </button>
      </div>
    </div>
  );
}

const AdvancedSettingsModal: React.FC<Props> = ({
  isOpen = true,
  onClose = () => {},
}) => {
  if (!isOpen) return null;
  const isAdmin = useIsAdmin();
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2500,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          width: 640,
          maxWidth: "95%",
          background: "#0B1220",
          border: "1px solid #1F2937",
          borderRadius: 16,
          padding: 16,
          color: "#E5E7EB",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 800 }}>Settings</div>
          <button
            onClick={onClose}
            style={{
              padding: "4px 8px",
              borderRadius: 8,
              border: "1px solid #374151",
              background: "#111827",
              color: "#E5E7EB",
            }}
          >
            Close
          </button>
        </div>

        {/* Add your existing settings here; this block is additive */}
        {isAdmin && <BetaControls />}
        {!isAdmin && (
          <div style={{ opacity: 0.8, fontSize: 12 }}>
            Additional beta controls are visible to admin only.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedSettingsModal;
