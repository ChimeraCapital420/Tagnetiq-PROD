// FILE: api/inventory.ts
// RH-009 — Inventory / ERP Lite
// Full CRUD for user inventory + sale logging + KPI summary
//
// GET  /api/inventory?userId=xxx                    → list inventory
// GET  /api/inventory?userId=xxx&status=listed      → filtered list
// GET  /api/inventory?userId=xxx&mode=kpis          → dashboard KPIs
// POST /api/inventory  { action: 'add', ...item }   → add item
// POST /api/inventory  { action: 'update', id, ...} → update item
// POST /api/inventory  { action: 'sell', id, salePrice, platform } → log sale
// POST /api/inventory  { action: 'delete', id }     → remove item

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 15 };

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// =============================================================================
// GET — List inventory or KPIs
// =============================================================================

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const { userId, status, category, mode, limit = '50', ghost } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId required' });
  }

  // ── KPI dashboard mode ────────────────────────────────────────────────
  if (mode === 'kpis') {
    const [inventoryRes, salesRes] = await Promise.all([
      supabase
        .from('inventory_items')
        .select('status, hydra_value, purchase_price, is_ghost')
        .eq('user_id', userId),
      supabase
        .from('inventory_sales')
        .select('sale_price, purchase_price, sold_at')
        .eq('user_id', userId)
        .gte('sold_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const items = inventoryRes.data || [];
    const sales = salesRes.data || [];

    const inInventory  = items.filter(i => i.status === 'in_inventory' && !i.is_ghost);
    const listed       = items.filter(i => i.status === 'listed');
    const ghostItems   = items.filter(i => i.is_ghost);
    const totalValue   = inInventory.reduce((s, i) => s + (parseFloat(i.hydra_value) || 0), 0);
    const totalCost    = inInventory.reduce((s, i) => s + (parseFloat(i.purchase_price) || 0), 0);
    const revenue30d   = sales.reduce((s, i) => s + (parseFloat(i.sale_price) || 0), 0);
    const profit30d    = sales.reduce((s, i) => s + (parseFloat(i.sale_price) || 0) - (parseFloat(i.purchase_price) || 0), 0);

    return res.status(200).json({
      success: true,
      kpis: {
        totalItems:    inInventory.length,
        totalValue:    Math.round(totalValue * 100) / 100,
        totalCost:     Math.round(totalCost * 100) / 100,
        unrealizedGain: Math.round((totalValue - totalCost) * 100) / 100,
        itemsListed:   listed.length,
        itemsSold30d:  sales.length,
        revenue30d:    Math.round(revenue30d * 100) / 100,
        profit30d:     Math.round(profit30d * 100) / 100,
        ghostItems:    ghostItems.length,
        roi: totalCost > 0
          ? Math.round(((totalValue - totalCost) / totalCost) * 100 * 10) / 10
          : 0,
      },
    });
  }

  // ── Inventory list ────────────────────────────────────────────────────
  let query = supabase
    .from('inventory_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit as string) || 50);

  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  if (ghost === 'true') query = query.eq('is_ghost', true);
  if (ghost === 'false') query = query.eq('is_ghost', false);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ success: true, items: data || [], count: data?.length || 0 });
}

// =============================================================================
// POST — Add / Update / Sell / Delete
// =============================================================================

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const { action, userId, id, ...payload } = req.body;

  if (!userId) return res.status(400).json({ error: 'userId required' });
  if (!action) return res.status(400).json({ error: 'action required' });

  // ── Add item ──────────────────────────────────────────────────────────
  if (action === 'add') {
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        user_id:          userId,
        analysis_id:      payload.analysisId || null,
        item_name:        payload.itemName || 'Unknown Item',
        category:         payload.category || 'general',
        condition:        payload.condition || 'good',
        quantity:         payload.quantity || 1,
        purchase_price:   payload.purchasePrice || null,
        hydra_value:      payload.hydraValue || null,
        listed_price:     payload.listedPrice || null,
        last_valued_at:   payload.hydraValue ? new Date().toISOString() : null,
        status:           payload.status || 'in_inventory',
        location_name:    payload.locationName || null,
        location_lat:     payload.locationLat || null,
        location_lng:     payload.locationLng || null,
        is_ghost:         payload.isGhost || false,
        ghost_store:      payload.ghostStore || null,
        ghost_expires_at: payload.isGhost
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 day ghost
          : null,
        primary_image_url: payload.primaryImageUrl || null,
        image_urls:        payload.imageUrls || null,
        notes:             payload.notes || null,
        tags:              payload.tags || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, item: data });
  }

  // ── Update item ───────────────────────────────────────────────────────
  if (action === 'update') {
    if (!id) return res.status(400).json({ error: 'id required' });

    const updateData: Record<string, any> = {};
    if (payload.itemName      !== undefined) updateData.item_name      = payload.itemName;
    if (payload.condition     !== undefined) updateData.condition      = payload.condition;
    if (payload.quantity      !== undefined) updateData.quantity       = payload.quantity;
    if (payload.purchasePrice !== undefined) updateData.purchase_price = payload.purchasePrice;
    if (payload.hydraValue    !== undefined) { updateData.hydra_value = payload.hydraValue; updateData.last_valued_at = new Date().toISOString(); }
    if (payload.listedPrice   !== undefined) updateData.listed_price   = payload.listedPrice;
    if (payload.status        !== undefined) updateData.status         = payload.status;
    if (payload.locationName  !== undefined) updateData.location_name  = payload.locationName;
    if (payload.notes         !== undefined) updateData.notes          = payload.notes;
    if (payload.tags          !== undefined) updateData.tags           = payload.tags;

    const { data, error } = await supabase
      .from('inventory_items')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, item: data });
  }

  // ── Log sale ──────────────────────────────────────────────────────────
  if (action === 'sell') {
    if (!id) return res.status(400).json({ error: 'id required' });
    if (!payload.salePrice) return res.status(400).json({ error: 'salePrice required' });

    // Get item to record purchase price
    const { data: item } = await supabase
      .from('inventory_items')
      .select('item_name, purchase_price')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    // Insert sale record
    const [saleRes, updateRes] = await Promise.all([
      supabase.from('inventory_sales').insert({
        user_id:        userId,
        inventory_id:   id,
        item_name:      item?.item_name || payload.itemName || 'Unknown',
        sale_price:     payload.salePrice,
        purchase_price: item?.purchase_price || payload.purchasePrice || null,
        platform:       payload.platform || 'unknown',
        notes:          payload.notes || null,
      }).select().single(),
      // Mark item as sold
      supabase.from('inventory_items')
        .update({ status: 'sold' })
        .eq('id', id)
        .eq('user_id', userId),
    ]);

    if (saleRes.error) return res.status(500).json({ error: saleRes.error.message });
    return res.status(200).json({ success: true, sale: saleRes.data });
  }

  // ── Delete item ───────────────────────────────────────────────────────
  if (action === 'delete') {
    if (!id) return res.status(400).json({ error: 'id required' });

    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET')  return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}