// api/nexus/feedback.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
import { supaAdmin } from '../_lib/supaAdmin'; // Assuming shared supaAdmin client
import { verifyUser } from '../_lib/security'; // Assuming shared user verification

/**
 * This endpoint logs user feedback on the accuracy of a specific analysis
 * to the analysis_feedback table. This data is critical for training
 * the Judicium weighted consensus engine.
 *
 * @param req VercelRequest The incoming request.
 * @param res VercelResponse The outgoing response.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const user = await verifyUser(req);
    const { analysis_id, rating, comments } = req.body;

    // --- Data Validation ---
    if (!analysis_id || typeof rating !== 'number') {
      return res.status(400).json({
        error: 'Invalid request body. Required fields are: analysis_id (string) and rating (number).',
      });
    }

    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
    }

    // --- Database Insertion ---
    // Inserts the feedback into the 'analysis_feedback' table.
    const { data, error } = await supaAdmin
      .from('analysis_feedback')
      .insert([
        {
          analysis_id: analysis_id,
          user_id: user.id, // Use the verified user's ID
          accuracy_rating: rating,
          user_comments: comments || null, // comments are optional
        },
      ])
      .select('id'); // Select only the ID for a minimal response

    if (error) {
      console.error('Supabase error inserting analysis feedback:', error);
      return res.status(500).json({
        error: 'Failed to log analysis feedback.',
        details: error.message,
      });
    }

    console.log('Successfully logged analysis feedback:', data);
    return res.status(201).json({ success: true, feedback_id: data[0].id });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Unexpected error in /api/nexus/feedback:', message);
    return res.status(500).json({ error: message });
  }
}