// api/admin/cerberus/provision-agent.ts
import { supaAdmin } from '../../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUserIsAdmin } from '../../_lib/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Use your existing security - admin only
    await verifyUserIsAdmin(req);

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const testAgent = {
      email: `claude-test-${Date.now()}@cerberus.tagnetiq.com`,
      password: `cerberus-${Date.now()}-${Math.random().toString(36)}`,
      metadata: {
        is_ai_agent: true,
        model: 'claude-3-opus',
        provider: 'anthropic',
        purpose: 'automated_testing'
      }
    };

    // Create auth user
    const { data: authData, error: authError } = await supaAdmin.auth.admin.createUser({
      email: testAgent.email,
      password: testAgent.password,
      email_confirm: true,
      user_metadata: testAgent.metadata
    });

    if (authError) throw authError;

    // Create profile
    const { error: profileError } = await supaAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: testAgent.email,
        role: 'beta_tester',
        display_name: 'Claude Test Agent',
        metadata: {
          ...testAgent.metadata,
          created_at: new Date().toISOString()
        }
      });

    if (profileError) throw profileError;

    // Return credentials
    return res.status(200).json({
      success: true,
      credentials: {
        email: testAgent.email,
        password: testAgent.password,
        userId: authData.user.id
      },
      message: 'AI Test Agent created successfully!'
    });

  } catch (error: any) {
    console.error('Error provisioning AI agent:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to provision AI agent' 
    });
  }
}