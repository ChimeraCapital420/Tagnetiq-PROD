// FILE: api/scan-history.ts
// RH-020 — Item History Layer
// Returns a user's scan history timeline, grouped by item name
// Powers the "scan again" comparison and price trend display
//
// GET /api/scan-history?userId=xxx
// GET /api/scan-history?userId=xxx&category=coins
// GET /api/scan-history?userId=xxx&itemName=Morgan+Dollar&limit=10
// GET /api/scan-history?userId=xxx&limit=50  (all recent scans)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 15 };

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface ScanHistoryEntry {
  analysisId:          string;
  itemName:            string;
  estimatedValue:      number;
  decision:            'BUY' | 'SELL';
  confidence:          number;
  totalVotes:          number;
  scannedAt:           string;
  // Trend data vs previous scan of same item
  valueDelta?:         number;      // $ change from last scan
  valueDeltaPct?:      number;      // % change from last scan
  priceDirection?:     'up' | 'down' | 'flat' | 'first_scan';
  imageUrl?:           string | null;
}

export interface ItemPriceHistory {
  itemName:     string;
  scanCount:    number;
  firstScanned: string;
  lastScanned:  string;
  currentValue: number;
  peakValue:    number;
  lowestValue:  number;
  avgValue:     number;
  priceHistory: { date: string; value: number; confidence: number }[];
  trend:        'rising' | 'falling' | 'stable' | 'volatile';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const { userId, itemName, category, limit = '20', mode = 'timeline' } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId required' });
  }

  const limitNum = Math.min(parseInt(limit as string) || 20, 100);

  try {
    // ── Mode: timeline — recent scans for a user ────────────────────────────
    if (mode === 'timeline') {
      let query = supabase
        .from('consensus_results')
        .select(`
          analysis_id,
          final_item_name,
          final_value,
          final_decision,
          consensus_confidence,
          total_votes,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(limitNum);

      // Filter by item name if provided
      if (itemName && typeof itemName === 'string') {
        query = query.ilike('final_item_name', `%${itemName}%`);
      }

      // Get user's analysis IDs from ai_votes (since consensus_results has no user_id)
      // First get user's analysis IDs
      const { data: userVotes } = await supabase
        .from('ai_votes')
        .select('analysis_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200); // look back further to find matching consensus results

      if (!userVotes || userVotes.length === 0) {
        return res.status(200).json({
          success: true,
          userId,
          scans: [],
          summary: { totalScans: 0, uniqueItems: 0 },
        });
      }

      const analysisIds = [...new Set(userVotes.map(v => v.analysis_id))];

      // Now get consensus results for those analysis IDs
      const { data: results, error } = await supabase
        .from('consensus_results')
        .select(`
          analysis_id,
          final_item_name,
          final_value,
          final_decision,
          consensus_confidence,
          total_votes,
          created_at
        `)
        .in('analysis_id', analysisIds.slice(0, limitNum * 2))
        .order('created_at', { ascending: false })
        .limit(limitNum);

      if (error) throw error;

      // Build timeline with price delta calculation
      const scans: ScanHistoryEntry[] = [];
      const itemLastSeen: Record<string, number> = {};

      for (const row of results || []) {
        const itemKey = (row.final_item_name || '').toLowerCase().trim();
        const currentValue = parseFloat(row.final_value) || 0;
        const prevValue = itemLastSeen[itemKey];

        let valueDelta: number | undefined;
        let valueDeltaPct: number | undefined;
        let priceDirection: ScanHistoryEntry['priceDirection'] = 'first_scan';

        if (prevValue !== undefined) {
          valueDelta = currentValue - prevValue;
          valueDeltaPct = prevValue > 0 ? (valueDelta / prevValue) * 100 : 0;
          priceDirection = Math.abs(valueDelta) < 0.5 ? 'flat'
            : valueDelta > 0 ? 'up' : 'down';
        }

        itemLastSeen[itemKey] = currentValue;

        scans.push({
          analysisId:    row.analysis_id,
          itemName:      row.final_item_name || 'Unknown Item',
          estimatedValue: currentValue,
          decision:      (row.final_decision as 'BUY' | 'SELL') || 'SELL',
          confidence:    parseFloat(row.consensus_confidence) || 0,
          totalVotes:    row.total_votes || 0,
          scannedAt:     row.created_at,
          valueDelta,
          valueDeltaPct: valueDeltaPct !== undefined ? Math.round(valueDeltaPct * 10) / 10 : undefined,
          priceDirection,
        });
      }

      const uniqueItems = new Set(scans.map(s => s.itemName.toLowerCase())).size;

      return res.status(200).json({
        success: true,
        userId,
        mode: 'timeline',
        scans,
        summary: {
          totalScans:   scans.length,
          uniqueItems,
          mostRecent:   scans[0]?.scannedAt || null,
          avgConfidence: scans.length > 0
            ? Math.round((scans.reduce((s, r) => s + r.confidence, 0) / scans.length) * 100)
            : 0,
        },
      });
    }

    // ── Mode: item-history — price history for a specific item ─────────────
    if (mode === 'item-history' && itemName && typeof itemName === 'string') {
      // Get all user's analysis IDs
      const { data: userVotes } = await supabase
        .from('ai_votes')
        .select('analysis_id')
        .eq('user_id', userId)
        .limit(500);

      if (!userVotes?.length) {
        return res.status(200).json({ success: true, itemHistory: null });
      }

      const analysisIds = [...new Set(userVotes.map(v => v.analysis_id))];

      const { data: results, error } = await supabase
        .from('consensus_results')
        .select('analysis_id, final_item_name, final_value, consensus_confidence, created_at')
        .in('analysis_id', analysisIds)
        .ilike('final_item_name', `%${itemName}%`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!results?.length) {
        return res.status(200).json({ success: true, itemHistory: null });
      }

      const values = results.map(r => parseFloat(r.final_value) || 0).filter(v => v > 0);
      const priceHistory = results.map(r => ({
        date:       r.created_at,
        value:      parseFloat(r.final_value) || 0,
        confidence: parseFloat(r.consensus_confidence) || 0,
      }));

      // Trend analysis
      let trend: ItemPriceHistory['trend'] = 'stable';
      if (values.length >= 2) {
        const first = values[0];
        const last  = values[values.length - 1];
        const pctChange = first > 0 ? ((last - first) / first) * 100 : 0;
        const stdDev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - (values.reduce((a, b) => a + b, 0) / values.length), 2), 0) / values.length);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const cv = avg > 0 ? stdDev / avg : 0; // coefficient of variation

        trend = cv > 0.3 ? 'volatile'
          : pctChange > 5  ? 'rising'
          : pctChange < -5 ? 'falling'
          : 'stable';
      }

      const history: ItemPriceHistory = {
        itemName:     results[0].final_item_name,
        scanCount:    results.length,
        firstScanned: results[0].created_at,
        lastScanned:  results[results.length - 1].created_at,
        currentValue: values[values.length - 1] || 0,
        peakValue:    Math.max(...values),
        lowestValue:  Math.min(...values),
        avgValue:     Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
        priceHistory,
        trend,
      };

      return res.status(200).json({ success: true, mode: 'item-history', itemHistory: history });
    }

    // ── Mode: vault-summary — value of all scanned items ───────────────────
    if (mode === 'vault-summary') {
      const { data: userVotes } = await supabase
        .from('ai_votes')
        .select('analysis_id')
        .eq('user_id', userId)
        .limit(1000);

      if (!userVotes?.length) {
        return res.status(200).json({ success: true, vaultSummary: { totalItems: 0, totalValue: 0, items: [] } });
      }

      const analysisIds = [...new Set(userVotes.map(v => v.analysis_id))];

      // Get most recent scan per item name
      const { data: results } = await supabase
        .from('consensus_results')
        .select('final_item_name, final_value, final_decision, consensus_confidence, created_at')
        .in('analysis_id', analysisIds)
        .order('created_at', { ascending: false });

      // Dedupe — keep most recent per item name
      const seen = new Set<string>();
      const uniqueItems = (results || []).filter(r => {
        const key = (r.final_item_name || '').toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const totalValue = uniqueItems.reduce((s, r) => s + (parseFloat(r.final_value) || 0), 0);

      return res.status(200).json({
        success: true,
        mode: 'vault-summary',
        vaultSummary: {
          totalItems:  uniqueItems.length,
          totalValue:  Math.round(totalValue * 100) / 100,
          items:       uniqueItems.map(r => ({
            itemName:       r.final_item_name,
            currentValue:   parseFloat(r.final_value) || 0,
            decision:       r.final_decision,
            confidence:     parseFloat(r.consensus_confidence) || 0,
            lastScanned:    r.created_at,
          })),
        },
      });
    }

    return res.status(400).json({ error: 'Invalid mode. Use: timeline | item-history | vault-summary' });

  } catch (error: any) {
    console.error('scan-history error:', error);
    return res.status(500).json({ error: error.message });
  }
}