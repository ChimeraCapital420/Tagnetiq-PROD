import React, { useRef, useState } from "react";

type Result = {
  decision: string;
  confidence: number;
  imagesProcessed: number;
  notes?: string;
  analysisId?: string; // when wired to your engine
};

export default function MultiImageAnalyzer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function onFiles(files: FileList | null) {
    if (!files) return;
    const next: string[] = [];
    const max = Math.min(files.length, 12); // cap to prevent giant payloads
    for (let i = 0; i < max; i++) {
      const f = files[i];
      if (!f.type.startsWith("image/")) continue;
      next.push(URL.createObjectURL(f));
    }
    setPreviews(next);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    onFiles(e.dataTransfer.files);
  }

  async function runAnalysis() {
    try {
      setBusy(true);
      setErr(null);
      setResult(null);
      const input = inputRef.current;
      if (!input || !input.files || input.files.length === 0) {
        setErr("Select at least one image.");
        setBusy(false);
        return;
      }

      const fd = new FormData();
      for (const f of Array.from(input.files)) {
        if (f.type.startsWith("image/")) fd.append("images[]", f);
      }
      fd.append(
        "meta",
        JSON.stringify({
          userId: "anon", // wire to auth if available
          sessionTs: Date.now(),
        })
      );

      const res = await fetch("/api/analyze-images", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Analyze failed");
      setResult(json);
    } catch (e: any) {
      setErr(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function sendThumbsUp() {
    if (!result) return;
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: result.analysisId || `local_${Date.now()}`,
          decision: result.decision,
          thumbsUp: true,
          meta: { source: "multi-image-ui" },
        }),
      });
      alert("Thanks! Your feedback helps improve the model.");
    } catch {
      // swallow
    }
  }

  return (
    <div className="space-y-4">
      {/* Picker */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed rounded p-4 text-center"
      >
        <p className="mb-2">Drag & drop images here, or</p>
        <button
          type="button"
          className="px-3 py-2 bg-black text-white rounded"
          onClick={() => inputRef.current?.click()}
        >
          Choose Images
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      {/* Previews */}
      {previews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {previews.map((src, i) => (
            <img
              key={i}
              src={src}
              className="w-full h-28 object-cover rounded border"
              alt={`preview-${i}`}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          disabled={busy || previews.length === 0}
          onClick={runAnalysis}
          className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
        >
          {busy ? "Analyzing…" : "Analyze Images"}
        </button>
        {result && (
          <button
            onClick={sendThumbsUp}
            className="px-3 py-2 border rounded"
            title="Mark this result as correct"
          >
            👍 Thumbs Up
          </button>
        )}
      </div>

      {/* Result */}
      {err && <div className="text-red-600 text-sm">{err}</div>}
      {result && (
        <div className="text-sm border rounded p-3">
          <div><b>Decision:</b> {result.decision}</div>
          <div><b>Confidence:</b> {(result.confidence * 100).toFixed(1)}%</div>
          <div><b>Images processed:</b> {result.imagesProcessed}</div>
          {result.notes && <div className="opacity-70 mt-1">{result.notes}</div>}
        </div>
      )}
    </div>
  );
}
