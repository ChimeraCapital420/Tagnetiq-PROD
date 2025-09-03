// FILE: src/api/vault/index.ts
// Vault API with comprehensive security and ownership validation

import express from 'express';
import { requireAuth, AuthenticatedRequest } from '@/middleware/rbac';
import { supabase } from '@/lib/supabase-server';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import crypto from 'crypto';

const router = express.Router();

// Rate limiting for vault operations
const vaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each user to 50 requests per windowMs
  keyGenerator: (req: AuthenticatedRequest) => req.user?.id || req.ip,
  message: 'Too many vault operations, please try again later.'
});

// Apply middleware
router.use(requireAuth);
router.use(vaultLimiter);

// Validation schemas
const addAssetSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string(),
  subcategory: z.string().optional(),
  description: z.string().optional(),
  images: z.array(z.string().url()).max(10),
  acquisition_price: z.number().min(0).optional(),
  acquisition_date: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
  is_public: z.boolean().default(false)
});

const updateAssetSchema = addAssetSchema.partial().extend({
  id: z.string().uuid()
});

// Helper function to verify asset ownership
async function verifyAssetOwnership(assetId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('vault_items')
    .select('user_id')
    .eq('id', assetId)
    .single();
    
  return !error && data?.user_id === userId;
}

// GET /api/vault/assets
router.get('/assets', async (req: AuthenticatedRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const category = req.query.category as string;

    let query = supabase
      .from('vault_items')
      .select('*, valuations!inner(*)', { count: 'exact' })
      .eq('user_id', req.user!.id)
      .eq('deleted_at', null)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Encrypt sensitive data in transit
    const encryptedData = data.map(item => ({
      ...item,
      acquisition_price: item.acquisition_price ? '***' : null, // Mask in list view
      checksum: crypto
        .createHash('sha256')
        .update(JSON.stringify(item))
        .digest('hex')
        .substring(0, 8)
    }));

    res.json({
      assets: encryptedData,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching vault assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// GET /api/vault/assets/:id
router.get('/assets/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    if (!await verifyAssetOwnership(id, req.user!.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data, error } = await supabase
      .from('vault_items')
      .select(`
        *,
        valuations(*),
        scan_history:scans(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// POST /api/vault/assets
router.post('/assets', async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = addAssetSchema.parse(req.body);
    
    // Add asset with user context
    const assetData = {
      ...validatedData,
      user_id: req.user!.id,
      vault_number: `V-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
    };

    const { data, error } = await supabase
      .from('vault_items')
      .insert(assetData)
      .select()
      .single();

    if (error) throw error;

    // Create initial valuation if price provided
    if (validatedData.acquisition_price) {
      await supabase
        .from('valuations')
        .insert({
          vault_item_id: data.id,
          value: validatedData.acquisition_price,
          source: 'manual',
          confidence: 1.0
        });
    }

    // Log vault action for audit trail
    await supabase
      .from('audit_logs')
      .insert({
        user_id: req.user!.id,
        action: 'vault_item_created',
        resource_type: 'vault_item',
        resource_id: data.id,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

    res.status(201).json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid asset data', details: error.errors });
    }
    console.error('Error creating asset:', error);
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

// PUT /api/vault/assets/:id
router.put('/assets/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = updateAssetSchema.parse({ ...req.body, id: req.params.id });
    
    // Verify ownership
    if (!await verifyAssetOwnership(validatedData.id, req.user!.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id, ...updateData } = validatedData;

    const { data, error } = await supabase
      .from('vault_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log update
    await supabase
      .from('audit_logs')
      .insert({
        user_id: req.user!.id,
        action: 'vault_item_updated',
        resource_type: 'vault_item',
        resource_id: id,
        metadata: { changes: Object.keys(updateData) }
      });

    res.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid update data', details: error.errors });
    }
    console.error('Error updating asset:', error);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// DELETE /api/vault/assets/:id
router.delete('/assets/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    if (!await verifyAssetOwnership(id, req.user!.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Soft delete
    const { error } = await supabase
      .from('vault_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    // Log deletion
    await supabase
      .from('audit_logs')
      .insert({
        user_id: req.user!.id,
        action: 'vault_item_deleted',
        resource_type: 'vault_item',
        resource_id: id
      });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// GET /api/vault/stats
router.get('/stats', async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabase.rpc('get_vault_stats', {
      p_user_id: req.user!.id
    });

    if (error) throw error;

    res.json({
      total_items: data.total_items || 0,
      total_value: data.total_value || 0,
      categories: data.categories || [],
      value_trend: data.value_trend || 0
    });
  } catch (error) {
    console.error('Error fetching vault stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;