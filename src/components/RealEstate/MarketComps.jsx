import React, { useState } from "react";

export default function MarketComps() {
  const [form, setForm] = useState({ address: "", city: "", state: "", zip: "" });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  async function fetchComps(e) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      const qs = new URLSearchParams(form);
      const res = await fetch(`/api/market-comps?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fetch failed");
      setData(json);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Market Comps (ATTOM)</h2>
      <form onSubmit={fetchComps} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input className="border p-2 rounded" placeholder="Address" value={form.address}
          onChange={e => setForm({ ...form, address: e.target.value })} required />
        <input className="border p-2 rounded" placeholder="City" value={form.city}
          onChange={e => setForm({ ...form, city: e.target.value })} required />
        <input className="border p-2 rounded" placeholder="State" value={form.state}
          onChange={e => setForm({ ...form, state: e.target.value })} required />
        <input className="border p-2 rounded" placeholder="ZIP (optional)" value={form.zip}
          onChange={e => setForm({ ...form, zip: e.target.value })} />
        <button className="col-span-1 sm:col-span-4 bg-black text-white p-2 rounded disabled:opacity-50" disabled={loading}>
          {loading ? "Loading…" : "Get Comps"}
        </button>
      </form>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      {data && (
        <div className="space-y-3">
          <div className="text-sm opacity-75">
            <div><strong>Property:</strong> {data.subject?.address}</div>
            <div><strong>Estimate:</strong> {data.estimate ? `$${Number(data.estimate).toLocaleString()}` : "—"}</div>
          </div>
          <div className="border rounded">
            <div className="px-3 py-2 font-medium border-b">Recent Sales (radius ~1mi)</div>
            {data.comps?.length ? (
              <ul className="divide-y">
                {data.comps.map((c, i) => (
                  <li key={i} className="px-3 py-2 text-sm">
                    <div className="font-medium">{c.address || "—"}</div>
                    <div className="opacity-75">
                      {c.beds ?? "—"} bd · {c.baths ?? "—"} ba · {c.sqft ? `${c.sqft.toLocaleString()} sqft` : "—"}
                    </div>
                    <div>Sold {c.date || "—"} · {c.price ? `$${Number(c.price).toLocaleString()}` : "—"}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-4 text-sm opacity-70">No comps returned.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
