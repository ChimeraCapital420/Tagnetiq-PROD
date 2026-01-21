// FILE: src/pages/api/vault/items/delete.ts
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

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
    const { itemIds } = await request.json() as { itemIds: string[] };

    if (!itemIds || itemIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No items specified' }), {
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
        photos,
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

    // Calculate total value being deleted for logging
    const totalValue = items.reduce((sum, item) => {
      const val = item.valuation_data?.estimatedValue;
      if (val) {
        const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
        return sum + (isNaN(num) ? 0 : num);
      }
      return sum;
    }, 0);

    // Collect photo URLs for cleanup (optional - depends on storage setup)
    const photoUrls: string[] = [];
    items.forEach(item => {
      if (item.photos && Array.isArray(item.photos)) {
        photoUrls.push(...item.photos);
      }
    });

    // Archive items before deletion (soft delete option)
    // First, try to insert into archived_vault_items table
    const archiveData = items.map(item => ({
      original_id: item.id,
      vault_id: item.vault_id,
      asset_name: item.asset_name,
      photos: item.photos,
      valuation_data: item.valuation_data,
      deleted_by: user.id,
      deleted_at: new Date().toISOString()
    }));

    // Try to archive (table may not exist, so we catch the error)
    await supabase
      .from('archived_vault_items')
      .insert(archiveData)
      .catch(err => {
        console.warn('Archive table may not exist, skipping archive:', err.message);
      });

    // Delete the items
    const { error: deleteError } = await supabase
      .from('vault_items')
      .delete()
      .in('id', itemIds);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return new Response(JSON.stringify({ error: 'Failed to delete items' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Clean up photos from storage (if using Supabase Storage)
    if (photoUrls.length > 0) {
      try {
        // Extract file paths from URLs and delete from storage
        const filePaths = photoUrls
          .filter(url => url.includes('supabase'))
          .map(url => {
            // Extract path from Supabase storage URL
            const match = url.match(/\/storage\/v1\/object\/public\/([^?]+)/);
            return match ? match[1] : null;
          })
          .filter(Boolean) as string[];

        if (filePaths.length > 0) {
          await supabase.storage
            .from('vault-photos')
            .remove(filePaths)
            .catch(err => {
              console.warn('Photo cleanup failed (non-critical):', err.message);
            });
        }
      } catch (err) {
        console.warn('Photo cleanup error (non-critical):', err);
      }
    }

    // Log the deletion for audit purposes
    await supabase.from('vault_activity_log').insert({
      user_id: user.id,
      action: 'items_deleted',
      item_ids: itemIds,
      details: {
        count: itemIds.length,
        total_value: totalValue,
        item_names: items.map(i => i.asset_name)
      },
      created_at: new Date().toISOString()
    }).catch(err => {
      // Don't fail the request if logging fails
      console.warn('Failed to log activity:', err);
    });

    return new Response(JSON.stringify({ 
      success: true,
      deletedCount: itemIds.length,
      totalValueDeleted: totalValue
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Delete error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};