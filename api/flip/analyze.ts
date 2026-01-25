// FILE: api/flip/analyze.ts
// Authenticated Flip Analysis - Secure endpoint for profit calculations
// Uses same auth pattern as main analyze.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { analyzeFlip } from './index.js';
import { generateListing } from './listing-generator.js';
import { exportToAllPlatforms, exportToPlatform } from './export-templates.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

// Environment variables (same as analyze.ts)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ==================== AUTH (Same as analyze.ts) ====================

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

// ==================== REQUEST TYPES ====================

interface FlipAnalyzeRequest {
  // From HYDRA analysis result (or manual input)
  itemName: string;
  category: string;
  estimatedValue: number;
  
  // User input
  buyPrice: number;
  
  // Optional - improves accuracy
  condition?: 'mint' | 'near-mint' | 'excellent' | 'good' | 'fair' | 'poor';
  confidence?: number;
  valuation_factors?: string[];
  tags?: string[];
  
  // Optional - for exports
  location?: string;
  shippingIncluded?: boolean;
  acceptsOffers?: boolean;
  
  // What to return
  include?: {
    quickScore?: boolean;      // Default: true
    profitBreakdown?: boolean; // Default: true
    listing?: boolean;         // Default: false
    exports?: boolean;         // Default: false
    exportPlatforms?: string[]; // Filter to specific platforms
  };
}

// ==================== API HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ===== AUTHENTICATION (same as analyze.ts) =====
    const user = await verifyUser(req);
    
    // ===== VALIDATION =====
    const body = req.body as FlipAnalyzeRequest;
    
    if (!body.itemName || typeof body.itemName !== 'string') {
      return res.status(400).json({ error: 'itemName is required' });
    }
    
    if (typeof body.estimatedValue !== 'number' || body.estimatedValue <= 0) {
      return res.status(400).json({ error: 'estimatedValue must be a positive number' });
    }
    
    if (typeof body.buyPrice !== 'number' || body.buyPrice < 0) {
      return res.status(400).json({ error: 'buyPrice must be a non-negative number' });
    }
    
    // Sanitize inputs
    const sanitizedInput = {
      itemName: body.itemName.trim().substring(0, 200),
      category: (body.category || 'general').toLowerCase().trim(),
      estimatedValue: Math.max(0, body.estimatedValue),
      buyPrice: Math.max(0, body.buyPrice),
      condition: body.condition || 'good',
      confidence: body.confidence ? Math.min(1, Math.max(0, body.confidence)) : 0.75,
      valuation_factors: (body.valuation_factors || []).slice(0, 10),
      tags: (body.tags || []).slice(0, 20),
      location: body.location?.trim().substring(0, 100),
      shippingIncluded: body.shippingIncluded ?? true,
      acceptsOffers: body.acceptsOffers ?? true,
      include: {
        quickScore: body.include?.quickScore ?? true,
        profitBreakdown: body.include?.profitBreakdown ?? true,
        listing: body.include?.listing ?? false,
        exports: body.include?.exports ?? false,
        exportPlatforms: body.include?.exportPlatforms,
      },
    };
    
    // ===== CALCULATE FLIP ANALYSIS =====
    console.log(`💰 Flip analysis for user ${user.id}: ${sanitizedInput.itemName}`);
    console.log(`   Buy: $${sanitizedInput.buyPrice} | Estimated: $${sanitizedInput.estimatedValue}`);
    
    const result = analyzeFlip({
      itemName: sanitizedInput.itemName,
      category: sanitizedInput.category,
      estimatedValue: sanitizedInput.estimatedValue,
      buyPrice: sanitizedInput.buyPrice,
      condition: sanitizedInput.condition,
      confidence: sanitizedInput.confidence,
      valuation_factors: sanitizedInput.valuation_factors,
      tags: sanitizedInput.tags,
      location: sanitizedInput.location,
      shippingIncluded: sanitizedInput.shippingIncluded,
      acceptsOffers: sanitizedInput.acceptsOffers,
      include: sanitizedInput.include,
    });
    
    console.log(`   Result: ${result.summary.emoji} ${result.summary.verdict} | Profit: $${result.summary.netProfit.toFixed(2)}`);
    
    // ===== OPTIONAL: LOG TO ANALYTICS =====
    // You could log flip analyses for insights
    try {
      await supabase.from('flip_analyses').insert({
        user_id: user.id,
        item_name: sanitizedInput.itemName,
        category: sanitizedInput.category,
        estimated_value: sanitizedInput.estimatedValue,
        buy_price: sanitizedInput.buyPrice,
        score: result.summary.score,
        verdict: result.summary.verdict,
        net_profit: result.summary.netProfit,
        best_platform: result.summary.bestPlatform,
        created_at: new Date().toISOString(),
      }).then(() => {
        // Non-blocking, don't await
      });
    } catch (logError) {
      // Don't fail if logging fails
      console.warn('Flip analysis logging failed (non-fatal)');
    }
    
    return res.status(200).json(result);
    
  } catch (error: any) {
    const message = error.message || 'An unknown error occurred';
    console.error('Flip analysis error:', error);
    
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    
    return res.status(500).json({
      error: 'Flip analysis failed',
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    });
  }
}

// ==================== OPTIONAL: DATABASE TABLE ====================
/*
-- Run this in Supabase SQL editor to enable analytics

CREATE TABLE IF NOT EXISTS flip_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category TEXT,
  estimated_value DECIMAL(10,2),
  buy_price DECIMAL(10,2),
  score INTEGER,
  verdict TEXT,
  net_profit DECIMAL(10,2),
  best_platform TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user queries
CREATE INDEX idx_flip_analyses_user ON flip_analyses(user_id, created_at DESC);

-- RLS Policy
ALTER TABLE flip_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own flip analyses"
  ON flip_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flip analyses"
  ON flip_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);
*/