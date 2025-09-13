// FILE: api/user/interests.ts
// User interests management endpoint for the Oracle's proactive intelligence

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_SECRET!
);

// Schema validation
const interestSchema = z.object({
  interest_type: z.enum(['category', 'keyword', 'brand']),
  interest_value: z.string().min(1).max(100)
});

const deleteSchema = z.object({
  id: z.string().uuid()
});

async function verifyAuth(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  
  return user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    switch (req.method) {
      case 'GET':
        // Fetch all interests for the user
        const { data: interests, error: fetchError } = await supabase
          .from('user_interests')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        return res.status(200).json({ interests });

      case 'POST':
        // Add a new interest
        const newInterest = interestSchema.parse(req.body);
        
        const { data: created, error: createError } = await supabase
          .from('user_interests')
          .insert({
            user_id: user.id,
            ...newInterest
          })
          .select()
          .single();

        if (createError) {
          if (createError.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Interest already exists' });
          }
          throw createError;
        }

        return res.status(201).json(created);

      case 'DELETE':
        // Delete an interest
        const { id } = deleteSchema.parse(req.query);
        
        const { error: deleteError } = await supabase
          .from('user_interests')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id); // Double-check ownership

        if (deleteError) throw deleteError;

        return res.status(200).json({ success: true });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data' });
    }
    
    console.error('Interest management error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}