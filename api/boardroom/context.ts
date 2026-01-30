// FILE: api/boardroom/context.ts
// Manage company context documents for the AI Board
// These documents are injected into every board member's system prompt

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

// =============================================================================
// TYPES
// =============================================================================
interface CompanyContextDocument {
  id?: string;
  title: string;
  content: string;
  category: string;
  priority: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    // Verify boardroom access (admin or owner)
    const { data: access } = await supaAdmin
      .from('boardroom_access')
      .select('access_level')
      .eq('user_id', user.id)
      .single();

    if (!access || !['admin', 'owner'].includes(access.access_level)) {
      return res.status(403).json({ error: 'Admin access required to manage company context' });
    }

    // =========================================================================
    // GET - List all context documents
    // =========================================================================
    if (req.method === 'GET') {
      const { id, category, active_only } = req.query;

      if (id) {
        // Get single document
        const { data: doc, error } = await supaAdmin
          .from('boardroom_company_context')
          .select('*')
          .eq('id', id)
          .single();

        if (error) return res.status(404).json({ error: 'Document not found' });
        return res.status(200).json(doc);
      }

      // List all documents
      let query = supaAdmin
        .from('boardroom_company_context')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      if (active_only === 'true') {
        query = query.eq('is_active', true);
      }

      const { data: docs, error } = await query;

      if (error) {
        console.error('Error fetching context:', error);
        return res.status(500).json({ error: 'Failed to fetch documents' });
      }

      // Calculate total token estimate (rough: 4 chars = 1 token)
      const totalChars = docs?.reduce((sum, doc) => sum + (doc.content?.length || 0), 0) || 0;
      const estimatedTokens = Math.ceil(totalChars / 4);

      return res.status(200).json({
        documents: docs || [],
        stats: {
          total: docs?.length || 0,
          active: docs?.filter(d => d.is_active).length || 0,
          estimated_tokens: estimatedTokens,
          categories: [...new Set(docs?.map(d => d.category))],
        },
      });
    }

    // =========================================================================
    // POST - Add a new context document
    // =========================================================================
    if (req.method === 'POST') {
      const { title, content, category, priority, is_active } = req.body;

      if (!title || !content) {
        return res.status(400).json({ error: 'title and content are required' });
      }

      const { data: doc, error } = await supaAdmin
        .from('boardroom_company_context')
        .insert({
          title,
          content,
          category: category || 'general',
          priority: priority ?? 5,
          is_active: is_active ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating context:', error);
        return res.status(500).json({ error: 'Failed to create document' });
      }

      return res.status(201).json({
        message: 'Document added to company context',
        document: doc,
      });
    }

    // =========================================================================
    // PUT - Update an existing document
    // =========================================================================
    if (req.method === 'PUT') {
      const { id, title, content, category, priority, is_active } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'id is required' });
      }

      const updates: Partial<CompanyContextDocument> = {
        updated_at: new Date().toISOString(),
      };

      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      if (category !== undefined) updates.category = category;
      if (priority !== undefined) updates.priority = priority;
      if (is_active !== undefined) updates.is_active = is_active;

      const { data: doc, error } = await supaAdmin
        .from('boardroom_company_context')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating context:', error);
        return res.status(500).json({ error: 'Failed to update document' });
      }

      return res.status(200).json({
        message: 'Document updated',
        document: doc,
      });
    }

    // =========================================================================
    // DELETE - Remove a document
    // =========================================================================
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'id query parameter is required' });
      }

      const { error } = await supaAdmin
        .from('boardroom_company_context')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting context:', error);
        return res.status(500).json({ error: 'Failed to delete document' });
      }

      return res.status(200).json({ message: 'Document deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    console.error('Context API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}