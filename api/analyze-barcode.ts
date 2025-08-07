import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// API Keys - Store these in your Vercel environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
const XAI_API_KEY = process.env.XAI_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

interface BarcodeAnalysisRequest {
  barcode: string;
  scanType: 'barcode';
  userId: string;
}

interface ProductData {
  title: string;
  brand?: string;
  category?: string;
  upc?: string;
  ean?: string;
  asin?: string;
}

// Hydra AI Consensus Engine
class HydraConsensusEngine {
  async analyzeBarcode(barcode: string): Promise<any> {
    // Step 1: Product identification via multiple APIs
    const productData = await this.identifyProduct(barcode);
    
    // Step 2: Multi-AI analysis
    const analyses = await Promise.allSettled([
      this.claudeAnalysis(productData),
      this.gptAnalysis(productData),
      this.geminiAnalysis(productData),
      this.deepSeekAnalysis(productData),
      this.grokMarketSentiment(productData)
    ]);

    // Step 3: Consensus building
    return this.buildConsensus(analyses, productData);
  }

  private async identifyProduct(barcode: string): Promise<ProductData> {
    // Try multiple product databases
    const sources = [
      this.queryUPCDatabase(barcode),
      this.queryBarcodeSpider(barcode),
      this.queryOpenFoodFacts(barcode)
    ];

    const results = await Promise.allSettled(sources);
    
    // Return the first successful result or basic data
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        return result.value;
      }
    }

    return {
      title: `Product ${barcode}`,
      upc: barcode
    };
  }

  private async queryUPCDatabase(barcode: string): Promise<ProductData | null> {
    try {
      // UPC Database API call
      const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        return {
          title: item.title,
          brand: item.brand,
          category: item.category,
          upc: barcode
        };
      }
    } catch (error) {
      console.error('UPC Database error:', error);
    }
    return null;
  }

  private async queryBarcodeSpider(barcode: string): Promise<ProductData | null> {
    try {
      // Barcode Spider API (if available)
      const response = await fetch(`https://api.barcodespider.com/v1/lookup?token=YOUR_TOKEN&upc=${barcode}`);
      const data = await response.json();
      
      if (data.item_response && data.item_response.message === 'success') {
        return {
          title: data.item_response.item_attributes.title,
          brand: data.item_response.item_attributes.brand,
          upc: barcode
        };
      }
    } catch (error) {
      console.error('Barcode Spider error:', error);
    }
    return null;
  }

  private async queryOpenFoodFacts(barcode: string): Promise<ProductData | null> {
    try {
      // Open Food Facts for food products
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();
      
      if (data.status === 1) {
        return {
          title: data.product.product_name || data.product.product_name_en,
          brand: data.product.brands,
          category: data.product.categories,
          ean: barcode
        };
      }
    } catch (error) {
      console.error('Open Food Facts error:', error);
    }
    return null;
  }

  private async claudeAnalysis(productData: ProductData): Promise<any> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Analyze this product for Amazon arbitrage potential:
            
Product: ${productData.title}
Brand: ${productData.brand || 'Unknown'}
Category: ${productData.category || 'Unknown'}
UPC/EAN: ${productData.upc || productData.ean}

Provide analysis in JSON format:
{
  "itemName": "product name",
  "estimatedValue": number,
  "profitPotential": "high/medium/low",
  "marketDemand": "high/medium/low",
  "competitionLevel": "high/medium/low",
  "decision": "BUY/PASS",
  "reasoning": "brief explanation"
}`
          }]
        })
      });

      const data = await response.json();
      return JSON.parse(data.content[0].text);
    } catch (error) {
      console.error('Claude analysis error:', error);
      return null;
    }
  }

  private async gptAnalysis(productData: ProductData): Promise<any> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{
            role: 'user',
            content: `Analyze this product for resale value and market potential:
            
Product: ${productData.title}
Brand: ${productData.brand || 'Unknown'}
Category: ${productData.category || 'Unknown'}

Return JSON with: itemName, estimatedValue, marketTrend, salesRank, decision (BUY/PASS)`
          }],
          temperature: 0.3
        })
      });

      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error('GPT analysis error:', error);
      return null;
    }
  }

  private async geminiAnalysis(productData: ProductData): Promise<any> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GOOGLE_AI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Product analysis for ${productData.title}. Analyze market viability, pricing trends, and give BUY/PASS recommendation with estimated value.`
            }]
          }]
        })
      });

      const data = await response.json();
      // Parse Gemini response format
      return {
        itemName: productData.title,
        estimatedValue: 0, // Parse from response
        decision: 'PASS' // Parse from response
      };
    } catch (error) {
      console.error('Gemini analysis error:', error);
      return null;
    }
  }

  private async deepSeekAnalysis(productData: ProductData): Promise<any> {
    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{
            role: 'user',
            content: `Mathematical analysis of ${productData.title} for arbitrage. Calculate profit margins, ROI, and market metrics.`
          }]
        })
      });

      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error('DeepSeek analysis error:', error);
      return null;
    }
  }

  private async grokMarketSentiment(productData: ProductData): Promise<any> {
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${XAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'grok-beta',
          messages: [{
            role: 'user',
            content: `Analyze current market sentiment and trends for ${productData.title} based on social media and news data.`
          }]
        })
      });

      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error('Grok analysis error:', error);
      return null;
    }
  }

  private buildConsensus(analyses: PromiseSettledResult<any>[], productData: ProductData): any {
    const validAnalyses = analyses
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => (result as PromiseFulfilledResult<any>).value);

    if (validAnalyses.length === 0) {
      return {
        itemName: productData.title,
        estimatedValue: '0.00',
        decision: 'PASS',
        confidence: 'low',
        reasoning: 'Insufficient data for analysis'
      };
    }

    // Calculate consensus
    const buyVotes = validAnalyses.filter(a => a.decision === 'BUY').length;
    const totalVotes = validAnalyses.length;
    const avgValue = validAnalyses
      .map(a => parseFloat(a.estimatedValue) || 0)
      .reduce((sum, val) => sum + val, 0) / validAnalyses.length;

    return {
      itemName: productData.title,
      estimatedValue: avgValue.toFixed(2),
      decision: buyVotes > totalVotes / 2 ? 'BUY' : 'PASS',
      confidence: totalVotes >= 3 ? 'high' : 'medium',
      analysisCount: totalVotes,
      consensusRatio: `${buyVotes}/${totalVotes}`
    };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { barcode, userId }: BarcodeAnalysisRequest = req.body;

    if (!barcode || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Initialize Hydra Engine
    const hydra = new HydraConsensusEngine();
    
    // Perform analysis
    const analysis = await hydra.analyzeBarcode(barcode);

    // Store in Supabase
    const { error } = await supabase
      .from('scan_history')
      .insert({
        user_id: userId,
        scan_type: 'barcode',
        barcode_data: barcode,
        analysis_result: analysis,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Database error:', error);
    }

    res.status(200).json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
}