// pages/test-dashboard.tsx or app/test-dashboard/page.tsx

export default function TestDashboard() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    const response = await fetch('/api/test-hydra-consensus');
    const data = await response.json();
    setResults(data);
    setLoading(false);
  };

  return (
    <div className="p-8">
      <h1>Hydra Engine Test Dashboard</h1>
      
      <button onClick={runTests} disabled={loading}>
        {loading ? 'Running Tests...' : 'Run All Tests'}
      </button>

      {results && (
        <div className="grid grid-cols-2 gap-4 mt-8">
          {/* AI Status Grid */}
          <div>
            <h2>AI Models Status</h2>
            <div className="grid grid-cols-4 gap-2">
              {['OpenAI', 'Anthropic', 'Google', 'Mistral', 'Groq', 'DeepSeek', 'xAI', 'Perplexity'].map(ai => (
                <div key={ai} className={`p-2 rounded ${
                  results.summary.activeAIs.includes(ai) ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {ai}
                </div>
              ))}
            </div>
          </div>

          {/* API Status Grid */}
          <div>
            <h2>API Sources Status</h2>
            <div className="grid grid-cols-3 gap-2">
              {['BrickSet', 'Numista', 'Chrono24', 'Colnect', 'CardHedge', 'TCGPlayer', 'PCGS', 'Edmunds', 'Entrupy'].map(api => (
                <div key={api} className={`p-2 rounded ${
                  results.summary.activeAPIs.includes(api) ? 'bg-green-500' : 'bg-gray-500'
                }`}>
                  {api}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}