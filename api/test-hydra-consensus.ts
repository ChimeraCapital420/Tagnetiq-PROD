// FILE: api/test-hydra-consensus.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Enable CORS
export const config = {
  runtime: 'nodejs',
};

function calculateCoverage(results: any[], field: string) {
  const total = results.reduce((acc, r) => acc + r[`expected${field.charAt(0).toUpperCase() + field.slice(1)}`].length, 0);
  const actual = results.reduce((acc, r) => acc + r[`actual${field.charAt(0).toUpperCase() + field.slice(1)}`].length, 0);
  return total > 0 ? (actual / total) * 100 : 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const testCases = [
      {
        category: "Trading Cards",
        item: "Charizard Base Set Pokemon Card",
        expectedAPIs: ["GoCollect", "Perplexity"],
        expectedAIs: ["OpenAI", "Anthropic", "Google", "Mistral", "Groq", "DeepSeek", "xAI", "Perplexity"]
      },
      {
        category: "Toys & Collectibles", 
        subcategory: "LEGO Sets",
        item: "LEGO Creator Expert 10255 Assembly Square",
        expectedAPIs: ["Brickset", "Perplexity"],
        expectedAIs: ["OpenAI", "Anthropic", "Google", "Mistral", "Groq", "DeepSeek", "xAI", "Perplexity"]
      },
      {
        category: "Coins & Currency",
        item: "1921 Morgan Silver Dollar",
        expectedAPIs: ["Numista", "PCGS", "Perplexity"],
        expectedAIs: ["OpenAI", "Anthropic", "Google", "Mistral", "Groq", "DeepSeek", "xAI", "Perplexity"]
      },
      {
        category: "Jewelry & Watches",
        subcategory: "Luxury Watches",
        item: "Rolex Submariner 116610",
        expectedAPIs: ["Chrono24", "Perplexity"],
        expectedAIs: ["OpenAI", "Anthropic", "Google", "Mistral", "Groq", "DeepSeek", "xAI", "Perplexity"]
      }
    ];

    const results = [];
    
    // First, let's just test if the analyze endpoint exists
    const baseUrl = `https://${req.headers.host}`;
    console.log('Testing with base URL:', baseUrl);
    
    for (const testCase of testCases) {
      const startTime = Date.now();
      
      try {
        // Mock the analysis for now since we need auth
        // In a real test, you'd include proper authentication
        const mockAnalysis = {
          analysisId: `test_${Date.now()}`,
          itemName: testCase.item,
          estimatedValue: Math.random() * 1000,
          decision: Math.random() > 0.5 ? 'BUY' : 'SELL',
          confidenceScore: Math.floor(Math.random() * 30) + 70,
          hydraConsensus: {
            totalSources: 8,
            aiModels: {
              responded: ["OpenAI", "Anthropic", "Google"],
              weights: {
                "OpenAI": 0.95,
                "Anthropic": 0.92,
                "Google": 0.88
              }
            },
            apiSources: {
              responded: testCase.expectedAPIs.slice(0, 2),
              data: {}
            }
          }
        };
        
        const endTime = Date.now();
        
        // Extract which sources responded
        const activeSources = {
          apis: mockAnalysis.hydraConsensus?.apiSources?.responded || [],
          ais: mockAnalysis.hydraConsensus?.aiModels?.responded || []
        };
        
        results.push({
          testCase: testCase.item,
          category: testCase.category,
          subcategory: testCase.subcategory,
          responseTime: endTime - startTime,
          expectedAPIs: testCase.expectedAPIs,
          actualAPIs: activeSources.apis,
          expectedAIs: testCase.expectedAIs,
          actualAIs: activeSources.ais,
          missingAPIs: testCase.expectedAPIs.filter(api => !activeSources.apis.includes(api)),
          missingAIs: testCase.expectedAIs.filter(ai => !activeSources.ais.includes(ai)),
          consensusScore: mockAnalysis.confidenceScore,
          value: mockAnalysis.estimatedValue,
          status: 'success'
        });
        
      } catch (error) {
        console.error('Test case error:', error);
        results.push({
          testCase: testCase.item,
          category: testCase.category,
          subcategory: testCase.subcategory,
          responseTime: Date.now() - startTime,
          expectedAPIs: testCase.expectedAPIs,
          actualAPIs: [],
          expectedAIs: testCase.expectedAIs,
          actualAIs: [],
          missingAPIs: testCase.expectedAPIs,
          missingAIs: testCase.expectedAIs,
          consensusScore: 0,
          value: 0,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    const summary = {
      totalTests: results.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      averageResponseTime: results.reduce((a, b) => a + b.responseTime, 0) / results.length,
      apiCoverage: calculateCoverage(results, 'APIs'),
      aiCoverage: calculateCoverage(results, 'AIs')
    };
    
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: {
        host: req.headers.host,
        nodeEnv: process.env.NODE_ENV
      },
      results,
      summary,
      note: 'This is a mock test. To test actual analysis, authentication is required.'
    });
    
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}