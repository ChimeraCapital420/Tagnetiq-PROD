// FILE: api/boardroom/context.ts
// Manage company context documents for the AI Board
// Supports text input AND file uploads (.md, .txt, .docx)

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
  source_type?: 'manual' | 'upload' | 'api';
  source_filename?: string;
  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// HELPER: Parse uploaded file content
// =============================================================================
function parseFileContent(base64Content: string, filename: string, mimeType: string): string {
  // Decode base64
  const buffer = Buffer.from(base64Content, 'base64');
  
  // Handle different file types
  if (mimeType === 'text/plain' || mimeType === 'text/markdown' || filename.endsWith('.md') || filename.endsWith('.txt')) {
    return buffer.toString('utf-8');
  }
  
  // For .docx, we'd need a parser - for now, return a message
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || filename.endsWith('.docx')) {
    // Basic extraction - in production you'd use mammoth or similar
    const text = buffer.toString('utf-8');
    // Try to extract readable text (very basic)
    const cleaned = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned.length > 100) {
      return cleaned;
    }
    return `[DOCX file uploaded: ${filename}] - For full extraction, paste the text content directly or use a .md/.txt file.`;
  }
  
  // JSON files
  if (mimeType === 'application/json' || filename.endsWith('.json')) {
    try {
      const json = JSON.parse(buffer.toString('utf-8'));
      return JSON.stringify(json, null, 2);
    } catch {
      return buffer.toString('utf-8');
    }
  }
  
  // Default: try as text
  return buffer.toString('utf-8');
}

// =============================================================================
// HELPER: Auto-detect category from content
// =============================================================================
function detectCategory(title: string, content: string): string {
  const text = `${title} ${content}`.toLowerCase();
  
  if (text.includes('tech stack') || text.includes('architecture') || text.includes('api') || text.includes('database')) {
    return 'tech_stack';
  }
  if (text.includes('revenue') || text.includes('financial') || text.includes('projection') || text.includes('burn rate')) {
    return 'financial';
  }
  if (text.includes('market') || text.includes('competitor') || text.includes('tam') || text.includes('addressable')) {
    return 'market';
  }
  if (text.includes('product') || text.includes('feature') || text.includes('roadmap')) {
    return 'product';
  }
  if (text.includes('legal') || text.includes('compliance') || text.includes('terms') || text.includes('privacy')) {
    return 'legal';
  }
  if (text.includes('strategy') || text.includes('okr') || text.includes('objective') || text.includes('goal')) {
    return 'strategy';
  }
  if (text.includes('company') || text.includes('mission') || text.includes('vision') || text.includes('team')) {
    return 'company';
  }
  
  return 'general';
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
        const { data: doc, error } = await supaAdmin
          .from('boardroom_company_context')
          .select('*')
          .eq('id', id)
          .single();

        if (error) return res.status(404).json({ error: 'Document not found' });
        return res.status(200).json(doc);
      }

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
    // POST - Add a new context document (supports file upload)
    // =========================================================================
    if (req.method === 'POST') {
      const { 
        title, 
        content, 
        category, 
        priority, 
        is_active,
        // File upload fields
        file_content,  // base64 encoded
        file_name,
        file_type,
      } = req.body;

      let finalContent = content;
      let finalTitle = title;
      let sourceType: 'manual' | 'upload' = 'manual';
      let sourceFilename: string | undefined;

      // Handle file upload
      if (file_content && file_name) {
        finalContent = parseFileContent(file_content, file_name, file_type || 'text/plain');
        finalTitle = title || file_name.replace(/\.[^/.]+$/, ''); // Remove extension for title
        sourceType = 'upload';
        sourceFilename = file_name;
      }

      if (!finalTitle || !finalContent) {
        return res.status(400).json({ error: 'title and content are required (or upload a file)' });
      }

      // Auto-detect category if not provided
      const finalCategory = category || detectCategory(finalTitle, finalContent);

      const { data: doc, error } = await supaAdmin
        .from('boardroom_company_context')
        .insert({
          title: finalTitle,
          content: finalContent,
          category: finalCategory,
          priority: priority ?? 5,
          is_active: is_active ?? true,
          source_type: sourceType,
          source_filename: sourceFilename,
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
        auto_detected_category: !category ? finalCategory : undefined,
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