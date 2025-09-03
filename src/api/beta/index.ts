// FILE: src/api/beta/index.ts
// Beta program API with full RBAC and validation

import express from 'express';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '@/middleware/rbac';
import { supabase } from '@/lib/supabase-server';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const inviteSchema = z.object({
  email: z.string().email()
});

const feedbackUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['new', 'in_review', 'fix_in_progress', 'shipped'])
});

// Public endpoints (require auth but not admin)
router.use(requireAuth);

// GET /api/beta/kpis - Admin only
router.get('/kpis', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_beta_kpis');
    
    if (error) throw error;
    
    res.json({
      totalTesters: data.total_testers || 0,
      invitesSent: data.invites_sent || 0,
      activationRate: data.activation_rate || '0%'
    });
  } catch (error) {
    console.error('Error fetching beta KPIs:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

// POST /api/beta/invite - Admin only
router.post('/invite', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { email } = inviteSchema.parse(req.body);
    
    // Check if already invited
    const { data: existing } = await supabase
      .from('beta_invites')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Email already invited' });
    }

    // Generate unique invite code
    const inviteCode = `BETA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    // Create invite
    const { data, error } = await supabase
      .from('beta_invites')
      .insert({
        email,
        invite_code: inviteCode,
        invited_by: req.user!.id,
        status: 'sent'
      })
      .select()
      .single();

    if (error) throw error;

    // TODO: Send actual invite email
    console.log(`Would send beta invite to ${email} with code ${inviteCode}`);

    res.json({ success: true, invite: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    console.error('Error sending beta invite:', error);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

// GET /api/admin/feedback - Admin only
router.get('/admin/feedback', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .select(`
        id,
        message,
        category,
        severity,
        status,
        app_version,
        created_at,
        tester:beta_testers!inner(
          user:profiles!inner(email)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const feedback = data.map(item => ({
      id: item.id,
      message: item.message,
      category: item.category,
      severity: item.severity,
      status: item.status,
      app_version: item.app_version,
      created_at: item.created_at,
      tester_email: item.tester?.user?.email || 'Unknown'
    }));

    res.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// PUT /api/admin/feedback - Admin only
router.put('/admin/feedback', requireAdmin, async (req, res) => {
  try {
    const { id, status } = feedbackUpdateSchema.parse(req.body);
    
    const { error } = await supabase
      .from('feedback')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data' });
    }
    console.error('Error updating feedback:', error);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

// GET /api/beta/welcome-pdf - Any authenticated user
router.get('/welcome-pdf', async (req, res) => {
  // For now, return a placeholder
  res.redirect('/placeholder.pdf');
});

export default router;