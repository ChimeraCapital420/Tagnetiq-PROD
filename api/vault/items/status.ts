// FILE: src/pages/api/vault/items/status.ts
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

interface SoldDetails {
  salePrice: string;
  saleDate: string;
  buyerInfo: string;
  platform: string;
  notes: string;
}

interface IncidentDetails {
  date: string;
  description: string;
  insuranceClaim: boolean;
  claimNumber: string;
  policeReport?: boolean;
  reportNumber?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const { itemIds, status, details } = await request.json() as {
      itemIds: string[];
      status: 'sold' | 'lost' | 'damaged' | 'stolen' | 'destroyed';
      details: SoldDetails | IncidentDetails;
    };

    if (!itemIds || itemIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No items specified' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!status) {
      return new Response(JSON.stringify({ error: 'Status is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify user owns these items (through vault ownership)
    const { data: items, error: fetchError } = await supabase
      .from('vault_items')
      .select(`
        id,
        vault_id,
        asset_name,
        valuation_data,
        vaults!inner (
          user_id
        )
      `)
      .in('id', itemIds)
      .eq('vaults.user_id', user.id);

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to verify item ownership' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!items || items.length !== itemIds.length) {
      return new Response(JSON.stringify({ error: 'Some items not found or not owned by user' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build status history entry
    const statusEntry = {
      status,
      date: new Date().toISOString(),
      details,
      previous_status: 'active' // Could be enhanced to track actual previous status
    };

    // Update items with new status
    const updatePromises = itemIds.map(async (itemId) => {
      const item = items.find(i => i.id === itemId);
      
      // Get existing status history or create new array
      const { data: currentItem } = await supabase
        .from('vault_items')
        .select('status_history')
        .eq('id', itemId)
        .single();

      const statusHistory = currentItem?.status_history || [];
      statusHistory.push(statusEntry);

      return supabase
        .from('vault_items')
        .update({
          status,
          status_history: statusHistory,
          status_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);
    });

    const results = await Promise.all(updatePromises);
    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
      console.error('Update errors:', errors);
      return new Response(JSON.stringify({ 
        error: 'Some items failed to update',
        failedCount: errors.length 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Log the status change for audit purposes
    await supabase.from('vault_activity_log').insert({
      user_id: user.id,
      action: `items_marked_${status}`,
      item_ids: itemIds,
      details: {
        count: itemIds.length,
        status,
        ...details
      },
      created_at: new Date().toISOString()
    }).catch(err => {
      // Don't fail the request if logging fails
      console.warn('Failed to log activity:', err);
    });

    return new Response(JSON.stringify({ 
      success: true,
      updatedCount: itemIds.length,
      status
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Status update error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};