// FILE: api/arena/watchlist.ts

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';
import { z } from 'zod'; // HEPHAESTUS NOTE: Added zod for robust validation

// HEPHAESTUS NOTE: Schemas for validating incoming request bodies.
const postSchema = z.object({
  keywords: z.array(z.string().min(1, "Keyword cannot be empty")).min(1, "Keywords array cannot be empty"),
});

const deleteSchema = z.object({
  id: z.string().uuid("Invalid watchlist ID format."),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req); // SECURITY: Verify user authentication

    if (req.method === 'GET') {
      const { data, error } = await supaAdmin
        .from('watchlists')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const validationResult = postSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: 'Invalid input.', details: validationResult.error.flatten() });
      }
      const { keywords } = validationResult.data;

      const { data, error } = await supaAdmin
        .from('watchlists')
        .insert({ user_id: user.id, keywords })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'DELETE') {
        const validationResult = deleteSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({ error: 'Invalid input.', details: validationResult.error.flatten() });
        }
        const { id } = validationResult.data;

        const { error } = await supaAdmin
            .from('watchlists')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id); // Ensures users can only delete their own watchlists
        if (error) throw error;
        
        // HEPHAESTUS NOTE: Using 204 No Content for successful deletions is a standard practice.
        return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request body.', details: error.flatten() });
    }
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error in watchlist handler:', message);
    return res.status(500).json({ error: message });
  }
}