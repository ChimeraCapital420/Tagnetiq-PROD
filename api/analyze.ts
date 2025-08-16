// api/analyze.ts
import { dataSources } from '../src/lib/datasources';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'edge'
};

interface AnalysisRequest {
  category_id: string;
  subcategory_id: string;
  scanType: 'barcode' | 'image' | 'vin';
  data: string; // This can be a barcode, image data, VIN, etc.
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

// Hydra Consensus Engine
class HydraConsensusEngine {
  // Store API keys in Vercel environment variables
  private ANTHROPIC_SECRET = process.env.ANTHROPIC_SECRET;
  private OPENAI_TOKEN = process.env.OPENAI_TOKEN;
  private GOOGLE_AI_TOKEN = process.env.GOOGLE_AI_TOKEN;
  private DEEPSEEK_TOKEN = process.env.DEEPSEEK_TOKEN;
  private XAI_SECRET = process.env.XAI_SECRET;
  
  // Tier 1 Data Source Keys
  private ATTOM_API_KEY = process.env.ATTOM_API_KEY;
  
  // Tier 2 Data Source Keys
  private HOUSE_CANARY_API_KEY = process.env.HOUSE_CANARY_API_KEY;

  async analyze(request: AnalysisRequest): Promise<HydraResponse> {
    console.log(`🚀 Starting Hydra analysis for: ${request.category_id}/${request.subcategory_id}`);
    
    // 1. Get Data Sources
    const sources = this.getSources(request.category_id, request.subcategory_id);
    if (!sources) {
      throw new Error('Invalid category or subcategory');
    }

    // 2. Parallel API Calls to Tier 1 and Tier 2
    const apiPromises = [
        ...sources.tier_1_sources.map(s => this.querySource(s, request.data)),
        ...sources.tier_2_sources.map(s => this.querySource(s, request.data))
    ];

    const results = await Promise.allSettled(apiPromises);

    // 3. Build Consensus
    return this.buildConsensus(results, request.data);
  }

  private getSources(categoryId: string, subcategoryId: string) {
    return dataSources.find(ds => ds.category_id === categoryId && ds.subcategory_id === subcategoryId);
  }

  private async querySource(source: any, data: string): Promise<any> {
    console.log(`⚡ Querying ${source.name}...`);
    // This is a placeholder for actual API calls.
    // In a real implementation, this would contain the logic to call each API.
    // For now, we will return a mock response.
    
    // Simulate API call latency
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
    
    return {
      source: source.name,
      decision: Math.random() > 0.5 ? 'BUY' : 'PASS',
      estimatedValue: (Math.random() * 100).toFixed(2)
    };
  }

  private buildConsensus(results: PromiseSettledResult<any>[], data: any): HydraResponse {
    const validAnalyses = results
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => (result as PromiseFulfilledResult<any>).value);

    if (validAnalyses.length === 0) {
      return {
        itemName: `Item ${data}`,
        estimatedValue: '0.00',
        decision: 'PASS',
        confidence: 'low',
        analysisCount: 0,
        consensusRatio: '0/0',
        reasoning: 'No data sources returned a valid analysis.'
      };
    }

    const buyVotes = validAnalyses.filter(a => a.decision === 'BUY').length;
    const totalVotes = validAnalyses.length;
    
    const values = validAnalyses
      .map(a => parseFloat(a.estimatedValue) || 0)
      .filter(v => v > 0);
    
    const avgValue = values.length > 0 
      ? values.reduce((sum, val) => sum + val, 0) / values.length 
      : 0;

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

    return {
      itemName: `Item ${data}`,
      estimatedValue: avgValue.toFixed(2),
      decision,
      confidence,
      analysisCount: totalVotes,
      consensusRatio: `${buyVotes}/${totalVotes}`,
      reasoning: `Synthesized from ${totalVotes} data sources.`
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body: AnalysisRequest = req.body;
        const { category_id, subcategory_id, scanType, data, userId } = body;

        if (!category_id || !subcategory_id || !scanType || !data || !userId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const hydra = new HydraConsensusEngine();
        const analysis = await hydra.analyze(body);

        return res.status(200).json(analysis);

    } catch (error) {
        console.error('❌ Analysis error:', error);
        return res.status(500).json({ 
            error: 'Analysis failed',
            itemName: 'Analysis Error',
            estimatedValue: '0.00',
            decision: 'PASS',
            confidence: 'low',
            reasoning: 'An error occurred during analysis'
        });
    }
}