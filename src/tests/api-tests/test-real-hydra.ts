import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HydraEngine } from '../src/lib/hydra-engine.js';

export const config = {
  maxDuration: 45,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Simple test case
    const testPrompt = `Analyze this item and provide valuation. Respond in JSON format ONLY: {"itemName": "specific name", "estimatedValue": "25.99", "decision": "BUY", "valuation_factors": ["Factor 1", "Factor 2", "Factor 3", "Factor 4", "Factor 5"], "summary_reasoning": "A brief summary.", "confidence": 0.85}`;
    
    // Test with a text description (no actual image needed for testing)
    const testImageData = "Test item: Vintage 1985 Nintendo Entertainment System (NES) console in original box";
    
    console.log('🚀 Initializing Hydra Engine for real test...');
    const hydra = new HydraEngine();
    await hydra.initialize();
    
    console.log('🔍 Running consensus analysis...');
    const startTime = Date.now();
    const consensus = await hydra.analyze([testImageData], testPrompt);
    const endTime = Date.now();
    
    // Extract which AIs actually responded
    const respondedAIs = consensus.votes
      .filter(vote => vote.success)
      .map(vote => vote.providerName);
    
    const aiStats = consensus.votes.map(vote => ({
      provider: vote.providerName,
      success: vote.success,
      confidence: vote.confidence,
      responseTime: vote.responseTime,
      weight: vote.weight,
      value: vote.estimatedValue,
      decision: vote.decision
    }));
    
    return res.status(200).json({
      success: true,
      testItem: "Vintage NES Console",
      totalProcessingTime: endTime - startTime,
      consensus: {
        itemName: consensus.consensus.itemName,
        estimatedValue: consensus.consensus.estimatedValue,
        decision: consensus.consensus.decision,
        confidence: consensus.consensus.confidence,
        analysisQuality: consensus.consensus.analysisQuality
      },
      aiProviders: {
        total: 8,
        responded: respondedAIs.length,
        list: respondedAIs,
        missing: ['OpenAI', 'Anthropic', 'Google', 'Mistral', 'Groq', 'DeepSeek', 'xAI', 'Perplexity']
          .filter(ai => !respondedAIs.includes(ai))
      },
      detailedStats: aiStats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Real Hydra test error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}