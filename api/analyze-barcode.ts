// api/analyze-barcode.ts
export const config = {
  runtime: 'edge'
};

interface BarcodeAnalysisRequest {
  barcode: string;
  scanType: 'barcode';
  userId: string;
}

interface HydraResponse {
  itemName: string;
  estimatedValue: string;
  decision: 'BUY' | 'PASS';
  confidence: 'high' | 'medium' | 'low';
  analysisCount: number;
  consensusRatio: string;
  reasoning: string;
}

// Hydra Consensus Engine for Barcodes
class HydraConsensusEngine {
  private ANTHROPIC_SECRET = process.env.ANTHROPIC_SECRET;
  private OPENAI_TOKEN = process.env.OPENAI_TOKEN;
  private GOOGLE_AI_TOKEN = process.env.GOOGLE_AI_TOKEN;
  private DEEPSEEK_TOKEN = process.env.DEEPSEEK_TOKEN;
  private XAI_SECRET = process.env.XAI_SECRET;
  private KROGER_CLIENT_ID = process.env.KROGER_CLIENT_ID;
  private KROGER_CLIENT_SECRET = process.env.KROGER_CLIENT_SECRET;
  private krogerAccessToken: string | null = null;

  async analyzeBarcode(barcode: string): Promise<HydraResponse> {
    console.log(`🔍 Hydra analyzing barcode: ${barcode}`);
    
    // Step 1: Product identification
    const productData = await this.identifyProduct(barcode);
    console.log(`📦 Product identified:`, productData);
    
    // Step 2: Multi-AI analysis
    const analyses = await Promise.allSettled([
      this.claudeAnalysis(productData),
      this.gptAnalysis(productData), 
      this.geminiAnalysis(productData),
      this.deepSeekAnalysis(productData),
      this.grokMarketSentiment(productData)
    ]);

    console.log(`🤖 AI Analysis results: ${analyses.filter(a => a.status === 'fulfilled').length}/5 successful`);
    
    // Step 3: Build consensus
    return this.buildConsensus(analyses, productData);
  }

  private async getKrogerAccessToken(): Promise<string | null> {
    if (!this.KROGER_CLIENT_ID || !this.KROGER_CLIENT_SECRET) {
      console.log('⚠️ Kroger credentials missing');
      return null;
    }

    if (this.krogerAccessToken) {
      return this.krogerAccessToken;
    }

    try {
      console.log('🔐 Getting Kroger access token...');
      
      // Kroger OAuth2 token endpoint
      const response = await fetch('https://api.kroger.com/v1/connect/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.KROGER_CLIENT_ID}:${this.KROGER_CLIENT_SECRET}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials&scope=product.compact'
      });

      if (response.ok) {
        const data = await response.json();
        this.krogerAccessToken = data.access_token;
        console.log('✅ Kroger access token obtained');
        
        // Token expires, so clear it after some time
        setTimeout(() => {
          this.krogerAccessToken = null;
        }, (data.expires_in - 60) * 1000); // Refresh 1 minute before expiry
        
        return this.krogerAccessToken;
      } else {
        console.error('❌ Failed to get Kroger access token:', response.status);
      }
    } catch (error) {
      console.error('Kroger OAuth error:', error);
    }
    
    return null;
  }

  private async identifyProduct(barcode: string) {
    console.log(`🔍 Looking up barcode: ${barcode}`);
    
    // Try Kroger API first (you have these credentials!)
    if (this.KROGER_CLIENT_ID && this.KROGER_CLIENT_SECRET) {
      const krogerResult = await this.queryKrogerAPI(barcode);
      if (krogerResult) return krogerResult;
    }
    
    // Try other free APIs
    const sources = [
      this.queryUPCDatabase(barcode),
      this.queryOpenFoodFacts(barcode),
      this.queryBarcodeMonster(barcode)
    ];

    const results = await Promise.allSettled(sources);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        console.log(`✅ Product found via database lookup`);
        return result.value;
      }
    }

    console.log(`⚠️ Product not found in databases, using barcode as identifier`);
    return {
      title: `Product ${barcode}`,
      brand: 'Unknown',
      category: 'Unknown',
      upc: barcode,
      description: `Unidentified product with barcode ${barcode}`
    };
  }

  private async queryKrogerAPI(barcode: string) {
    try {
      console.log(`🏪 Querying Kroger API for barcode: ${barcode}`);
      
      const accessToken = await this.getKrogerAccessToken();
      if (!accessToken) {
        console.log('❌ No Kroger access token available');
        return null;
      }

      // Kroger Product API - search by UPC
      const response = await fetch(`https://api.kroger.com/v1/products?filter.term=${barcode}&filter.locationId=01400943`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🏪 Kroger API response:', data);
        
        if (data.data && data.data.length > 0) {
          const product = data.data[0];
          console.log('✅ Product found in Kroger database');
          
          return {
            title: product.description || product.brand,
            brand: product.brand,
            category: product.categories?.[0] || 'Unknown',
            upc: barcode,
            price: product.items?.[0]?.price?.regular || product.items?.[0]?.price?.promo,
            description: product.description,
            size: product.items?.[0]?.size,
            krogerProductId: product.productId
          };
        } else {
          console.log('📦 Product not found in Kroger database');
        }
      } else {
        console.error('❌ Kroger API error:', response.status, await response.text());
      }
    } catch (error) {
      console.error('Kroger API error:', error);
    }
    return null;
  }

  private async queryUPCDatabase(barcode: string) {
    try {
      const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        return {
          title: item.title,
          brand: item.brand,
          category: item.category,
          upc: barcode,
          description: item.description
        };
      }
    } catch (error) {
      console.error('UPC Database error:', error);
    }
    return null;
  }

  private async queryOpenFoodFacts(barcode: string) {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();
      
      if (data.status === 1) {
        return {
          title: data.product.product_name || data.product.product_name_en,
          brand: data.product.brands,
          category: data.product.categories,
          upc: barcode,
          description: data.product.generic_name
        };
      }
    } catch (error) {
      console.error('Open Food Facts error:', error);
    }
    return null;
  }

  private async queryBarcodeMonster(barcode: string) {
    try {
      // Free barcode API
      const response = await fetch(`https://barcode-monster.com/api/${barcode}`);
      const data = await response.json();
      
      if (data.status === 'active') {
        return {
          title: data.description,
          brand: data.company,
          category: data.category,
          upc: barcode
        };
      }
    } catch (error) {
      console.error('Barcode Monster error:', error);
    }
    return null;
  }

  private async claudeAnalysis(productData: any) {
    if (!this.ANTHROPIC_SECRET) {
      console.log('⚠️ Claude API key missing');
      return null;
    }

    try {
      console.log('🤖 Running Claude analysis...');
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.ANTHROPIC_SECRET,
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
UPC: ${productData.upc}
Current Price: ${productData.price || 'Unknown'}

Provide analysis in JSON format only:
{
  "itemName": "product name",
  "estimatedValue": 15.99,
  "profitPotential": "high/medium/low",
  "marketDemand": "high/medium/low", 
  "competitionLevel": "high/medium/low",
  "decision": "BUY/PASS",
  "reasoning": "brief explanation"
}`
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const analysisText = data.content[0].text;
        
        // Try to extract JSON from the response
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      console.error('Claude analysis error:', error);
    }
    return null;
  }

  private async gptAnalysis(productData: any) {
    if (!this.OPENAI_TOKEN) {
      console.log('⚠️ OpenAI API key missing');
      return null;
    }

    try {
      console.log('🤖 Running GPT-4 analysis...');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.OPENAI_TOKEN}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{
            role: 'user',
            content: `Analyze this product for resale value and market potential:
            
Product: ${productData.title}
Brand: ${productData.brand || 'Unknown'}
Category: ${productData.category || 'Unknown'}

Return only JSON: {"itemName": "name", "estimatedValue": 0.00, "marketTrend": "up/down/stable", "decision": "BUY/PASS", "reasoning": "why"}`
          }],
          temperature: 0.3
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      console.error('GPT analysis error:', error);
    }
    return null;
  }

  private async geminiAnalysis(productData: any) {
    if (!this.GOOGLE_AI_TOKEN) {
      console.log('⚠️ Gemini API key missing'); 
      return null;
    }

    try {
      console.log('🤖 Running Gemini analysis...');
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.GOOGLE_AI_TOKEN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Product analysis for ${productData.title}. Analyze market viability, pricing trends, and give BUY/PASS recommendation with estimated value. Return as JSON only.`
            }]
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Parse Gemini response and format to standard structure
        return {
          itemName: productData.title,
          estimatedValue: this.extractValueFromText(text),
          decision: text.includes('BUY') ? 'BUY' : 'PASS',
          reasoning: text.substring(0, 100)
        };
      }
    } catch (error) {
      console.error('Gemini analysis error:', error);
    }
    return null;
  }

  private async deepSeekAnalysis(productData: any) {
    if (!this.DEEPSEEK_TOKEN) {
      console.log('⚠️ DeepSeek API key missing');
      return null;
    }

    try {
      console.log('🤖 Running DeepSeek analysis...');
      
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.DEEPSEEK_TOKEN}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{
            role: 'user',
            content: `Mathematical analysis of ${productData.title} for arbitrage. Calculate profit margins, ROI, and market metrics. Return JSON only.`
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      console.error('DeepSeek analysis error:', error);
    }
    return null;
  }

  private async grokMarketSentiment(productData: any) {
    if (!this.XAI_SECRET) {
      console.log('⚠️ Grok API key missing');
      return null;
    }

    try {
      console.log('🤖 Running Grok sentiment analysis...');
      
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.XAI_SECRET}`
        },
        body: JSON.stringify({
          model: 'grok-beta',
          messages: [{
            role: 'user',
            content: `Analyze current market sentiment and trends for ${productData.title} based on social media and news data. JSON only.`
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      console.error('Grok analysis error:', error);
    }
    return null;
  }

  private extractValueFromText(text: string): number {
    const valueMatch = text.match(/\$?(\d+(?:\.\d{2})?)/);
    return valueMatch ? parseFloat(valueMatch[1]) : 0;
  }

  private buildConsensus(analyses: PromiseSettledResult<any>[], productData: any): HydraResponse {
    const validAnalyses = analyses
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => (result as PromiseFulfilledResult<any>).value);

    console.log(`🎯 Building consensus from ${validAnalyses.length} valid analyses`);

    if (validAnalyses.length === 0) {
      return {
        itemName: productData.title,
        estimatedValue: '0.00',
        decision: 'PASS',
        confidence: 'low',
        analysisCount: 0,
        consensusRatio: '0/0',
        reasoning: 'No AI models were able to analyze this product'
      };
    }

    // Calculate consensus
    const buyVotes = validAnalyses.filter(a => a.decision === 'BUY').length;
    const totalVotes = validAnalyses.length;
    
    // Average estimated values
    const values = validAnalyses
      .map(a => parseFloat(a.estimatedValue) || 0)
      .filter(v => v > 0);
    
    const avgValue = values.length > 0 
      ? values.reduce((sum, val) => sum + val, 0) / values.length 
      : 0;

    // Determine confidence
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (totalVotes >= 3) {
      const agreementRatio = buyVotes / totalVotes;
      if (agreementRatio >= 0.8 || agreementRatio <= 0.2) {
        confidence = 'high';
      } else if (agreementRatio >= 0.6 || agreementRatio <= 0.4) {
        confidence = 'medium';
      }
    }

    const decision = buyVotes > totalVotes / 2 ? 'BUY' : 'PASS';
    
    console.log(`📊 Consensus: ${decision} (${buyVotes}/${totalVotes}) - $${avgValue.toFixed(2)} - ${confidence} confidence`);

    return {
      itemName: productData.title,
      estimatedValue: avgValue.toFixed(2),
      decision,
      confidence,
      analysisCount: totalVotes,
      consensusRatio: `${buyVotes}/${totalVotes}`,
      reasoning: `Analyzed by ${totalVotes} AI models. ${buyVotes} recommend BUY, ${totalVotes - buyVotes} recommend PASS. Average estimated value: $${avgValue.toFixed(2)}.`
    };
  }
}

export default async function handler(request: Request) {
  // Handle CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: BarcodeAnalysisRequest = await request.json();
    const { barcode, userId } = body;

    if (!barcode || !userId) {
      return new Response(JSON.stringify({ error: 'Missing barcode or userId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`🚀 Starting Hydra analysis for barcode: ${barcode}`);
    
    // Initialize Hydra Engine
    const hydra = new HydraConsensusEngine();
    
    // Perform analysis
    const analysis = await hydra.analyzeBarcode(barcode);

    console.log(`✅ Analysis complete:`, analysis);

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('❌ Barcode analysis error:', error);
    return new Response(JSON.stringify({ 
      error: 'Analysis failed',
      itemName: 'Analysis Error',
      estimatedValue: '0.00',
      decision: 'PASS',
      confidence: 'low',
      reasoning: 'An error occurred during analysis'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}