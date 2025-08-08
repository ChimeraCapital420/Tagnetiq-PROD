import React, { useState, useEffect } from 'react';

export default function MarketComps({ address = '', city = '', state = '', zip = '' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        // use backtick template so variables are interpolated properly
        const q = new URLSearchParams({ address, city, state, zip }).toString();
        const res = await fetch(`/api/market-comps?${q}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`API ${res.status}: ${text}`);
        }
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error('MarketComps fetch error', e);
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    }
    // only run if we have something to search; you can change to run always if desired
    if (address || city || state || zip) {
      load();
    }
  }, [address, city, state, zip]);

  if (loading) return <div className="p-4">Loading market data…</div>;
  if (err) return <div className="p-4 text-red-600">Error loading comps: {err}</div>;
  if (!data) return <div className="p-4">Enter address, city, state or zip to fetch comps.</div>;

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold">Market Comps for {data.address || '—'}</h2>
      <p className="text-sm text-gray-500">Mode: {data.mode || 'unknown'} • Source: {data.source || 'merged'}</p>

      {Array.isArray(data.comps) && data.comps.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {data.comps.map((c, i) => (
            <li key={i} className="border p-2 rounded">
              <div className="font-semibold">{c.address}</div>
              <div>${Number(c.price || 0).toLocaleString()} — {c.beds} bd / {c.baths} ba / {c.sqft} sqft</div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-gray-600">No comparables returned yet.</p>
      )}
    </div>
  );
}
