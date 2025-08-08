import { useState } from 'react';

export default function MarketComps() {
  const [address, setAddress] = useState('');
  const [comps, setComps] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchComps = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/Api/market-comps?address=${encodeURIComponent(address)}`);
      const data = await res.json();
      setComps(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold">Market Comps</h2>
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Enter address"
        className="border p-2 w-full mt-2"
      />
      <button onClick={fetchComps} disabled={loading} className="bg-blue-500 text-white p-2 mt-2">
        {loading ? 'Loading...' : 'Get Comps'}
      </button>

      {comps && (
        <div className="mt-4">
          <p className="text-sm text-gray-500">
            Data Source: {comps.source} ({comps.mode})
          </p>
          <ul className="mt-2 space-y-1">
            {comps.data.map((item, idx) => (
              <li key={idx} className="border p-2">
                {item.address} — ${item.price.toLocaleString()}  
                ({item.beds} bd / {item.baths} ba / {item.sqft} sqft)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
