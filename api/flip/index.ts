// FILE: api/flip/index.ts
// Flip Toolkit Orchestrator - One endpoint to rule them all
// Combines: Quick Score + Profit Calculator + Listing Generator + Export Templates

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { calculateQuickScore } from './quick-score.js';
import { calculateProfit } from './profit-calculator.js';
import { generateListing } from './listing-generator.js';
import { exportToAllPlatforms } from './export-templates.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

// ==================== TYPES ====================

interface FlipAnalysisInput {
  // Required - from HYDRA analysis
  itemName: string;
  category: string;
  estimatedValue: number;
  
  // Required - user input
  buyPrice: number;
  
  // Optional - enhances accuracy
  condition?: string;
  confidence?: number;
  valuation_factors?: string[];
  tags?: string[];
  marketComps?: any[];
  
  // Optional - user preferences
  location?: string;
  shippingIncluded?: boolean;
  acceptsOffers?: boolean;
  
  // What to include in response
  include?: {
    quickScore?: boolean;
    profitBreakdown?: boolean;
    listing?: boolean;
    exports?: boolean;
    exportPlatforms?: string[];  // Specific platforms only
  };
}

interface FlipAnalysisResult {
  // Quick summary (always included)
  summary: {
    itemName: string;
    category: string;
    buyPrice: number;
    sellPrice: number;
    
    // The key numbers
    netProfit: number;
    roi: number;
    profitMargin: number;
    
    // Quick verdict
    score: number;
    grade: string;
    emoji: string;
    verdict: string;
    action: string;
    
    // Best platform
    bestPlatform: string;
    bestPlatformProfit: number;
  };
  
  // Detailed sections (optional based on request)
  quickScore?: ReturnType<typeof calculateQuickScore>;
  profitBreakdown?: ReturnType<typeof calculateProfit>;
  listing?: ReturnType<typeof generateListing>;
  exports?: ReturnType<typeof exportToAllPlatforms>;
  
  // Metadata
  calculatedAt: string;
  processingTime: number;
}

// ==================== MAIN ORCHESTRATOR ====================

export function analyzeFlip(input: FlipAnalysisInput): FlipAnalysisResult {
  const startTime = Date.now();
  
  // Default include settings
  const include = {
    quickScore: input.include?.quickScore ?? true,
    profitBreakdown: input.include?.profitBreakdown ?? true,
    listing: input.include?.listing ?? false,
    exports: input.include?.exports ?? false,
    exportPlatforms: input.include?.exportPlatforms,
  };
  
  // Always calculate quick score for summary
  const quickScore = calculateQuickScore({
    itemName: input.itemName,
    category: input.category,
    estimatedValue: input.estimatedValue,
    buyPrice: input.buyPrice,
    condition: input.condition,
    confidence: input.confidence,
  });
  
  // Always calculate profit for summary
  const profitBreakdown = calculateProfit(
    input.itemName,
    input.category,
    input.estimatedValue,
    input.buyPrice,
    input.condition || 'good',
    8,
    input.shippingIncluded ?? true
  );
  
  // Build summary
  const bestPlatform = profitBreakdown.bestPlatform;
  const summary: FlipAnalysisResult['summary'] = {
    itemName: input.itemName,
    category: input.category,
    buyPrice: input.buyPrice,
    sellPrice: input.estimatedValue,
    netProfit: bestPlatform?.netProfit || 0,
    roi: bestPlatform?.roi || 0,
    profitMargin: bestPlatform?.profitMargin || 0,
    score: quickScore.score,
    grade: quickScore.grade,
    emoji: quickScore.emoji,
    verdict: quickScore.verdict,
    action: quickScore.recommendation.action,
    bestPlatform: bestPlatform?.platform || 'None',
    bestPlatformProfit: bestPlatform?.netProfit || 0,
  };
  
  // Build result
  const result: FlipAnalysisResult = {
    summary,
    calculatedAt: new Date().toISOString(),
    processingTime: Date.now() - startTime,
  };
  
  // Add optional sections
  if (include.quickScore) {
    result.quickScore = quickScore;
  }
  
  if (include.profitBreakdown) {
    result.profitBreakdown = profitBreakdown;
  }
  
  if (include.listing) {
    result.listing = generateListing({
      itemName: input.itemName,
      category: input.category,
      estimatedValue: input.estimatedValue,
      condition: input.condition,
      valuation_factors: input.valuation_factors,
      tags: input.tags,
    });
  }
  
  if (include.exports) {
    const allExports = exportToAllPlatforms({
      itemName: input.itemName,
      category: input.category,
      estimatedValue: input.estimatedValue,
      condition: input.condition,
      valuation_factors: input.valuation_factors,
      tags: input.tags,
      askingPrice: input.estimatedValue,
      shippingIncluded: input.shippingIncluded,
      acceptsOffers: input.acceptsOffers,
      location: input.location,
    });
    
    // Filter to specific platforms if requested
    if (include.exportPlatforms && include.exportPlatforms.length > 0) {
      allExports.exports = allExports.exports.filter(e => 
        include.exportPlatforms!.includes(e.platformSlug)
      );
    }
    
    result.exports = allExports;
  }
  
  result.processingTime = Date.now() - startTime;
  
  return result;
}

// ==================== API HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const input = req.body as FlipAnalysisInput;
    
    // Validation
    if (!input.itemName || typeof input.itemName !== 'string') {
      return res.status(400).json({ error: 'itemName is required' });
    }
    
    if (typeof input.estimatedValue !== 'number' || input.estimatedValue <= 0) {
      return res.status(400).json({ error: 'estimatedValue must be a positive number' });
    }
    
    if (typeof input.buyPrice !== 'number' || input.buyPrice < 0) {
      return res.status(400).json({ error: 'buyPrice must be a non-negative number' });
    }
    
    const result = analyzeFlip(input);
    
    return res.status(200).json(result);
    
  } catch (error: any) {
    console.error('Flip analysis error:', error);
    return res.status(500).json({
      error: 'Failed to analyze flip',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

// ==================== USAGE EXAMPLES ====================
/*

// Example 1: Quick check at thrift store (minimal request)
POST /api/flip
{
  "itemName": "Pokemon Charizard Holo Base Set",
  "category": "pokemon_cards",
  "estimatedValue": 150,
  "buyPrice": 45
}

// Returns summary with score, verdict, and best platform profit

// Example 2: Full analysis with exports
POST /api/flip
{
  "itemName": "Pokemon Charizard Holo Base Set",
  "category": "pokemon_cards",
  "estimatedValue": 150,
  "buyPrice": 45,
  "condition": "good",
  "confidence": 0.85,
  "include": {
    "quickScore": true,
    "profitBreakdown": true,
    "listing": true,
    "exports": true
  }
}

// Example 3: Just get eBay and Mercari exports
POST /api/flip
{
  "itemName": "LEGO Star Wars Millennium Falcon 75192",
  "category": "lego",
  "estimatedValue": 800,
  "buyPrice": 400,
  "include": {
    "exports": true,
    "exportPlatforms": ["ebay", "mercari"]
  }
}

*/