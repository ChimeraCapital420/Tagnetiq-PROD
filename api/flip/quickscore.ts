// FILE: api/flip/quick-score.ts
// Quick Score - Instant flip viability assessment
// Returns: Score 1-100, Emoji verdict (🔥 ✅ ⚠️ ❌), Recommendation

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { calculateProfit } from './profit-calculator.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

// ==================== TYPES ====================

interface QuickScoreInput {
  itemName: string;
  category: string;
  estimatedValue: number;
  buyPrice: number;
  condition?: string;
  
  // Optional factors that affect score
  confidence?: number;         // AI confidence 0-1
  marketDataAvailable?: boolean;
  competitionLevel?: 'low' | 'medium' | 'high';
  demandLevel?: 'low' | 'medium' | 'high';
  seasonality?: 'peak' | 'normal' | 'off';
}

interface QuickScoreResult {
  // Main score
  score: number;              // 1-100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  
  // Visual verdict
  emoji: string;              // 🔥 ✅ ⚠️ 🤔 ❌
  verdict: string;            // "HOT FLIP" | "Good Buy" | "Decent" | "Marginal" | "Pass"
  
  // Quick stats
  stats: {
    buyPrice: number;
    sellPrice: number;
    grossProfit: number;
    netProfit: number;         // After best platform fees
    roi: number;               // Return on investment %
    profitMargin: number;      // Profit margin %
  };
  
  // Best platform
  bestPlatform: {
    name: string;
    netProfit: number;
    fees: number;
  };
  
  // Factors breakdown
  factors: {
    name: string;
    score: number;
    maxScore: number;
    impact: 'positive' | 'neutral' | 'negative';
  }[];
  
  // Action recommendation
  recommendation: {
    action: 'BUY NOW' | 'CONSIDER' | 'NEGOTIATE' | 'PASS';
    reasoning: string;
    suggestedMaxBuy: number;   // Max you should pay
    minimumSellPrice: number;  // Min you should sell for
  };
  
  // Quick tips based on category
  tips: string[];
  
  calculatedAt: string;
}

// ==================== SCORING LOGIC ====================

interface ScoreFactor {
  name: string;
  score: number;
  maxScore: number;
  impact: 'positive' | 'neutral' | 'negative';
}

function calculateFactors(
  input: QuickScoreInput,
  profitData: ReturnType<typeof calculateProfit>
): ScoreFactor[] {
  const factors: ScoreFactor[] = [];
  const bestPlatform = profitData.bestPlatform;
  
  if (!bestPlatform) {
    return [{
      name: 'No profitable platform',
      score: 0,
      maxScore: 100,
      impact: 'negative'
    }];
  }
  
  // Factor 1: ROI (0-30 points)
  const roi = bestPlatform.roi;
  let roiScore = 0;
  let roiImpact: 'positive' | 'neutral' | 'negative' = 'neutral';
  
  if (roi >= 200) { roiScore = 30; roiImpact = 'positive'; }
  else if (roi >= 150) { roiScore = 27; roiImpact = 'positive'; }
  else if (roi >= 100) { roiScore = 24; roiImpact = 'positive'; }
  else if (roi >= 75) { roiScore = 20; roiImpact = 'positive'; }
  else if (roi >= 50) { roiScore = 15; roiImpact = 'neutral'; }
  else if (roi >= 25) { roiScore = 10; roiImpact = 'neutral'; }
  else if (roi >= 10) { roiScore = 5; roiImpact = 'negative'; }
  else { roiScore = 0; roiImpact = 'negative'; }
  
  factors.push({
    name: `ROI: ${roi.toFixed(0)}%`,
    score: roiScore,
    maxScore: 30,
    impact: roiImpact
  });
  
  // Factor 2: Profit Margin (0-25 points)
  const margin = bestPlatform.profitMargin;
  let marginScore = 0;
  let marginImpact: 'positive' | 'neutral' | 'negative' = 'neutral';
  
  if (margin >= 50) { marginScore = 25; marginImpact = 'positive'; }
  else if (margin >= 40) { marginScore = 22; marginImpact = 'positive'; }
  else if (margin >= 30) { marginScore = 18; marginImpact = 'positive'; }
  else if (margin >= 25) { marginScore = 14; marginImpact = 'neutral'; }
  else if (margin >= 20) { marginScore = 10; marginImpact = 'neutral'; }
  else if (margin >= 15) { marginScore = 6; marginImpact = 'negative'; }
  else { marginScore = 2; marginImpact = 'negative'; }
  
  factors.push({
    name: `Profit Margin: ${margin.toFixed(0)}%`,
    score: marginScore,
    maxScore: 25,
    impact: marginImpact
  });
  
  // Factor 3: Absolute Profit (0-25 points)
  const netProfit = bestPlatform.netProfit;
  let profitScore = 0;
  let profitImpact: 'positive' | 'neutral' | 'negative' = 'neutral';
  
  if (netProfit >= 100) { profitScore = 25; profitImpact = 'positive'; }
  else if (netProfit >= 50) { profitScore = 22; profitImpact = 'positive'; }
  else if (netProfit >= 30) { profitScore = 18; profitImpact = 'positive'; }
  else if (netProfit >= 20) { profitScore = 14; profitImpact = 'neutral'; }
  else if (netProfit >= 10) { profitScore = 10; profitImpact = 'neutral'; }
  else if (netProfit >= 5) { profitScore = 5; profitImpact = 'negative'; }
  else { profitScore = 0; profitImpact = 'negative'; }
  
  factors.push({
    name: `Net Profit: $${netProfit.toFixed(2)}`,
    score: profitScore,
    maxScore: 25,
    impact: profitImpact
  });
  
  // Factor 4: AI Confidence (0-10 points)
  const confidence = input.confidence || 0.7;
  let confScore = Math.round(confidence * 10);
  let confImpact: 'positive' | 'neutral' | 'negative' = 
    confidence >= 0.8 ? 'positive' : confidence >= 0.6 ? 'neutral' : 'negative';
  
  factors.push({
    name: `Valuation Confidence: ${(confidence * 100).toFixed(0)}%`,
    score: confScore,
    maxScore: 10,
    impact: confImpact
  });
  
  // Factor 5: Market Data (0-5 points)
  const hasMarketData = input.marketDataAvailable !== false;
  factors.push({
    name: `Market Data: ${hasMarketData ? 'Available' : 'Limited'}`,
    score: hasMarketData ? 5 : 2,
    maxScore: 5,
    impact: hasMarketData ? 'positive' : 'negative'
  });
  
  // Factor 6: Demand Level (0-5 points)
  const demand = input.demandLevel || 'medium';
  const demandScores = { high: 5, medium: 3, low: 1 };
  factors.push({
    name: `Demand: ${demand.charAt(0).toUpperCase() + demand.slice(1)}`,
    score: demandScores[demand],
    maxScore: 5,
    impact: demand === 'high' ? 'positive' : demand === 'low' ? 'negative' : 'neutral'
  });
  
  return factors;
}

function getVerdict(score: number): { emoji: string; verdict: string; grade: QuickScoreResult['grade'] } {
  if (score >= 85) return { emoji: '🔥', verdict: 'HOT FLIP', grade: 'A+' };
  if (score >= 75) return { emoji: '✅', verdict: 'Great Buy', grade: 'A' };
  if (score >= 60) return { emoji: '👍', verdict: 'Good Buy', grade: 'B' };
  if (score >= 45) return { emoji: '🤔', verdict: 'Decent', grade: 'C' };
  if (score >= 30) return { emoji: '⚠️', verdict: 'Marginal', grade: 'D' };
  return { emoji: '❌', verdict: 'Pass', grade: 'F' };
}

function getRecommendation(
  score: number,
  input: QuickScoreInput,
  bestProfit: number
): QuickScoreResult['recommendation'] {
  const { estimatedValue, buyPrice } = input;
  
  // Calculate suggested max buy (to maintain 25% margin minimum)
  const suggestedMaxBuy = Math.round(estimatedValue * 0.65 * 100) / 100;
  
  // Calculate minimum sell price (to break even after average fees ~15%)
  const minimumSellPrice = Math.round(buyPrice * 1.25 * 100) / 100;
  
  if (score >= 75) {
    return {
      action: 'BUY NOW',
      reasoning: `Strong flip potential with $${bestProfit.toFixed(2)} estimated profit. Don't hesitate!`,
      suggestedMaxBuy,
      minimumSellPrice
    };
  }
  
  if (score >= 55) {
    return {
      action: 'CONSIDER',
      reasoning: `Decent opportunity. ${buyPrice > suggestedMaxBuy ? `Try to negotiate down to $${suggestedMaxBuy.toFixed(2)} for better margin.` : 'Price is fair for resale.'}`,
      suggestedMaxBuy,
      minimumSellPrice
    };
  }
  
  if (score >= 35) {
    return {
      action: 'NEGOTIATE',
      reasoning: `Thin margins at this price. Only buy if you can get it for $${suggestedMaxBuy.toFixed(2)} or less.`,
      suggestedMaxBuy,
      minimumSellPrice
    };
  }
  
  return {
    action: 'PASS',
    reasoning: `Not enough profit potential. Would need to buy at $${suggestedMaxBuy.toFixed(2)} or find at lower price elsewhere.`,
    suggestedMaxBuy,
    minimumSellPrice
  };
}

function getCategoryTips(category: string, score: number): string[] {
  const baseTips: Record<string, string[]> = {
    pokemon_cards: [
      '🎴 Check for holo bleed, centering, and edges',
      '💎 Grading can 2-3x value for cards worth $50+',
      '📈 Vintage (1999-2003) cards trending up',
      '⚡ Check TCGPlayer for real-time prices',
    ],
    coins: [
      '🔍 Use a loupe to check for cleaning or damage',
      '📊 PCGS/NGC grading adds significant value',
      '💰 Silver/gold spot price is your floor value',
      '🏛️ Check Numista for variety identification',
    ],
    lego: [
      '📦 Sealed sets command 20-50% premium',
      '🧱 Count pieces if opened - completeness matters',
      '📅 Retired sets appreciate over time',
      '🔍 Check BrickLink for part values',
    ],
    video_games: [
      '🎮 CIB (Complete In Box) = 2-3x loose cart value',
      '📀 Check disc for scratches',
      '🔒 Sealed games = premium but verify seal authenticity',
      '📊 PriceCharting.com for accurate values',
    ],
    vinyl_records: [
      '🎵 First pressings worth more than reissues',
      '👀 Check vinyl and cover condition separately',
      '🔍 Discogs for pressing identification',
      '📦 VG+ minimum for good resale value',
    ],
    sneakers: [
      '👟 Check production date inside tongue',
      '📦 Box and accessories add 15-20% value',
      '🔬 Know how to spot fakes - reps are everywhere',
      '📱 Use CheckCheck app to verify authenticity',
    ],
    general: [
      '📸 Good photos = faster sales',
      '🏷️ Research completed eBay listings for real values',
      '📦 Factor in shipping costs before buying',
      '⏰ Some items sell faster at certain times of year',
    ],
  };
  
  const tips = baseTips[category] || baseTips.general;
  
  // Add score-based tips
  if (score >= 75) {
    tips.unshift('🔥 This looks like a winner - move fast!');
  } else if (score < 40) {
    tips.unshift('💡 Consider passing unless you can negotiate lower');
  }
  
  return tips.slice(0, 5);
}

// ==================== MAIN FUNCTION ====================

export function calculateQuickScore(input: QuickScoreInput): QuickScoreResult {
  // Get profit calculations
  const profitData = calculateProfit(
    input.itemName,
    input.category,
    input.estimatedValue,
    input.buyPrice,
    input.condition || 'good',
    8,  // Default weight
    true // Seller pays shipping (conservative)
  );
  
  const bestPlatform = profitData.bestPlatform;
  
  // Handle no-profit scenario
  if (!bestPlatform || bestPlatform.netProfit <= 0) {
    return {
      score: 10,
      grade: 'F',
      emoji: '❌',
      verdict: 'No Profit',
      stats: {
        buyPrice: input.buyPrice,
        sellPrice: input.estimatedValue,
        grossProfit: input.estimatedValue - input.buyPrice,
        netProfit: bestPlatform?.netProfit || 0,
        roi: bestPlatform?.roi || 0,
        profitMargin: bestPlatform?.profitMargin || 0,
      },
      bestPlatform: {
        name: bestPlatform?.platform || 'None',
        netProfit: bestPlatform?.netProfit || 0,
        fees: bestPlatform?.totalFees || 0,
      },
      factors: [{
        name: 'No profitable platform found',
        score: 0,
        maxScore: 100,
        impact: 'negative'
      }],
      recommendation: {
        action: 'PASS',
        reasoning: 'Cannot make profit at this buy price. Look for lower price or different item.',
        suggestedMaxBuy: Math.round(input.estimatedValue * 0.5 * 100) / 100,
        minimumSellPrice: Math.round(input.buyPrice * 1.3 * 100) / 100,
      },
      tips: getCategoryTips(input.category, 10),
      calculatedAt: new Date().toISOString(),
    };
  }
  
  // Calculate factors
  const factors = calculateFactors(input, profitData);
  
  // Sum up score
  const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
  const maxPossible = factors.reduce((sum, f) => sum + f.maxScore, 0);
  const normalizedScore = Math.round((totalScore / maxPossible) * 100);
  
  // Get verdict
  const { emoji, verdict, grade } = getVerdict(normalizedScore);
  
  // Get recommendation
  const recommendation = getRecommendation(normalizedScore, input, bestPlatform.netProfit);
  
  // Get tips
  const tips = getCategoryTips(input.category, normalizedScore);
  
  return {
    score: normalizedScore,
    grade,
    emoji,
    verdict,
    stats: {
      buyPrice: input.buyPrice,
      sellPrice: input.estimatedValue,
      grossProfit: Math.round((input.estimatedValue - input.buyPrice) * 100) / 100,
      netProfit: bestPlatform.netProfit,
      roi: bestPlatform.roi,
      profitMargin: bestPlatform.profitMargin,
    },
    bestPlatform: {
      name: bestPlatform.platform,
      netProfit: bestPlatform.netProfit,
      fees: bestPlatform.totalFees,
    },
    factors,
    recommendation,
    tips,
    calculatedAt: new Date().toISOString(),
  };
}

// ==================== API HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const input = req.body as QuickScoreInput;
    
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
    
    const result = calculateQuickScore(input);
    
    return res.status(200).json(result);
    
  } catch (error: any) {
    console.error('Quick score error:', error);
    return res.status(500).json({
      error: 'Failed to calculate quick score',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}