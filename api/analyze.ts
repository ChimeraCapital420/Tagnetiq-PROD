import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Edge-compatible configuration
export const config = {
  runtime: 'edge',
  maxDuration: 45,
};

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anthropicKey = process.env.ANTHROPIC_SECRET!;
const googleKey = process.env.GOOGLE_AI_TOKEN!;
const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_TOKEN!;

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Types
interface AnalysisRequest {
  scanType: 'barcode' | 'image' | 'vin' | 'multi-modal';
  data?: string;
  items?: Array<{
    type: string;
    data: string;
    name?: string;
    metadata?: any;
  }>;
  category_id: string;
  subcategory_id?: string;
}

interface AnalysisResult {
  id: string;
  itemName: string;
  estimatedValue: number;
  decision: 'BUY' | 'SELL';
  confidenceScore: number;
  summary_reasoning: string;
  valuation_factors: string[];
  analysis_quality: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';
  capturedAt: string;
  category: string;
  subCategory?: string;
  imageUrl: string;
  marketComps: any[];
  resale_toolkit: {
    listInArena: boolean;
    sellOnProPlatforms: boolean;
    linkToMyStore: boolean;
    shareToSocial: boolean;
  };
  tags: string[];
}

// Edge-compatible auth verification (no crypto dependencies)
async function verifyUser(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Authentication required');
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Authentication failed');
  }

  return user;
}

// AI Analysis Functions
async function analyzeWithClaude(imageData: string, prompt: string) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageData.replace(/^data:image\/[a-z]+;base64,/, '')
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0];
    return content?.type === 'text' ? content.text : null;
  } catch (error) {
    console.error('Claude analysis failed:', error);
    return null;
  }
}

async function analyzeWithGemini(imageData: string, prompt: string) {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${googleKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: imageData.replace(/^data:image\/[a-z]+;base64,/, '')
              }
            }
          ]
        }],
        generationConfig: {
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    console.error('Gemini analysis failed:', error);
    return null;
  }
}

async function analyzeWithOpenAI(imageData: string, prompt: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageData
              }
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('OpenAI analysis failed:', error);
    return null;
  }
}

// Fallback analysis with Gemini Flash
async function fallbackAnalysis(imageData: string, prompt: string) {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${googleKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: imageData.replace(/^data:image\/[a-z]+;base64,/, '')
              }
            }
          ]
        }],
        generationConfig: {
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Fallback API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    console.error('Fallback analysis failed:', error);
    return null;
  }
}

// Process analysis results
function parseAnalysisResult(rawResult: string | null): any | null {
  if (!rawResult) return null;
  
  try {
    const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.valuation_factors && Array.isArray(parsed.valuation_factors) && parsed.summary_reasoning) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('JSON parsing failed:', error);
  }
  
  return null;
}

// Build consensus from multiple analyses
function buildConsensus(analyses: any[], itemName: string, quality: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK'): Omit<AnalysisResult, 'id'|'capturedAt'|'marketComps'|'resale_toolkit'|'category'|'subCategory'|'tags'|'imageUrl'> {
  if (analyses.length === 0) {
    return {
      itemName,
      estimatedValue: 0.00,
      decision: 'SELL',
      confidenceScore: 0,
      summary_reasoning: 'All AI providers failed. System remains operational.',
      valuation_factors: ['Upstream Provider Error'],
      analysis_quality: 'FALLBACK'
    };
  }

  const totalVotes = analyses.length;
  const buyVotes = analyses.filter(a => a.decision === 'BUY').length;
  const values = analyses.map(a => parseFloat(a.estimatedValue) || 0).filter(v => v > 0);
  const avgValue = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  
  let confidenceScore = 0;
  if (totalVotes > 0) {
    const consensusRatio = Math.abs(buyVotes / totalVotes - 0.5) * 2;
    const confidenceFromCount = Math.min(1, totalVotes / 3);
    confidenceScore = Math.round((0.6 * consensusRatio + 0.4 * confidenceFromCount) * 100);
  }

  const factorCounts = new Map<string, number>();
  analyses.flatMap(a => a.valuation_factors).forEach(factor => {
    factorCounts.set(factor, (factorCounts.get(factor) || 0) + 1);
  });
  const sortedFactors = Array.from(factorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  const decision = buyVotes > totalVotes / 2 ? 'BUY' : 'SELL';
  const summary_reasoning = `Synthesized from ${totalVotes} AI model(s). ${analyses[0]?.summary_reasoning || 'No summary available.'}`;

  return {
    itemName,
    estimatedValue: parseFloat(avgValue.toFixed(2)),
    decision,
    confidenceScore,
    summary_reasoning,
    valuation_factors: sortedFactors.slice(0, 5),
    analysis_quality: quality
  };
}

// Main analysis function
async function performAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
  const jsonPrompt = `Analyze the item. Respond in JSON format ONLY: {"itemName": "specific name", "estimatedValue": "25.99", "decision": "BUY", "valuation_factors": ["Factor 1", "Factor 2", "Factor 3", "Factor 4", "Factor 5"], "summary_reasoning": "A brief summary."}`;
  
  let imageData = '';
  let itemName = 'Analysis';
  
  // Handle different scan types
  if (request.scanType === 'multi-modal' && request.items?.length) {
    imageData = request.items[0].data; // Use first image for now
    itemName = 'Multi-modal Analysis';
  } else if (request.data) {
    imageData = request.data;
    itemName = request.scanType === 'image' ? 'Image Analysis' : 'Barcode Analysis';
  }

  // Run analysis with multiple AI providers
  console.log('Initiating Hydra analysis...');
  const analysisPromises = [
    analyzeWithClaude(imageData, jsonPrompt),
    analyzeWithGemini(imageData, jsonPrompt),
    analyzeWithOpenAI(imageData, jsonPrompt)
  ];

  const results = await Promise.allSettled(analysisPromises);
  const validAnalyses: any[] = [];
  const providerNames = ['Claude', 'Gemini', 'OpenAI'];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      const parsed = parseAnalysisResult(result.value);
      if (parsed) {
        validAnalyses.push(parsed);
        console.log(`${providerNames[i]} analysis successful`);
      }
    } else {
      console.error(`${providerNames[i]} failed:`, result.status === 'rejected' ? result.reason : 'No result');
    }
  });

  let analysis_quality: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';
  
  // Handle fallback if needed
  if (validAnalyses.length === 0) {
    console.warn('All high-tier models failed. Executing fallback...');
    analysis_quality = 'FALLBACK';
    
    const fallbackResult = await fallbackAnalysis(imageData, jsonPrompt);
    const parsed = parseAnalysisResult(fallbackResult);
    if (parsed) {
      validAnalyses.push(parsed);
      itemName = parsed.itemName || itemName;
    }
  } else {
    analysis_quality = validAnalyses.length === 3 ? 'OPTIMAL' : 'DEGRADED';
    itemName = validAnalyses[0]?.itemName || itemName;
  }

  const consensus = buildConsensus(validAnalyses, itemName, analysis_quality);
  
  const fullResult: AnalysisResult = {
    ...consensus,
    id: `analysis_${Date.now()}`,
    capturedAt: new Date().toISOString(),
    category: request.category_id,
    subCategory: request.subcategory_id,
    imageUrl: imageData,
    marketComps: [],
    resale_toolkit: {
      listInArena: true,
      sellOnProPlatforms: true,
      linkToMyStore: false,
      shareToSocial: true
    },
    tags: [request.category_id]
  };
  
  return fullResult;
}

// Main API handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyUser(req);
    
    const body = req.body as AnalysisRequest;
    
    // Validation
    if (body.scanType === 'multi-modal') {
      if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
        return res.status(400).json({ error: 'Multi-modal analysis requires items array with at least one item.' });
      }
    } else {
      if (!body.scanType || !body.data || !body.category_id) {
        return res.status(400).json({ error: 'Missing required fields in analysis request.' });
      }
    }
    
    if (!body.category_id) {
      return res.status(400).json({ error: 'category_id is required for all analysis types.' });
    }

    const analysisResult = await performAnalysis(body);
    return res.status(200).json(analysisResult);
    
  } catch (error: any) {
    const message = error.message || 'An unknown error occurred.';
    console.error('Analysis handler error:', error);
    
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    
    return res.status(500).json({ 
      error: 'Analysis failed', 
      details: message 
    });
  }
}