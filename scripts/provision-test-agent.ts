// scripts/provision-test-agent.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function provisionTestAgent() {
  console.log('🤖 Provisioning AI Test Agent...');
  
  const testAgent = {
    email: 'claude-test@cerberus.tagnetiq.com',
    password: `cerberus-${Date.now()}-${Math.random().toString(36)}`,
    metadata: {
      is_ai_agent: true,
      model: 'claude-3-opus',
      provider: 'anthropic',
      purpose: 'automated_testing'
    }
  };

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testAgent.email,
      password: testAgent.password,
      email_confirm: true,
      user_metadata: testAgent.metadata
    });

    if (authError) throw authError;

    console.log('✅ Auth user created:', authData.user.id);

    const { error: profileError } = await supabaseAdmin
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

    console.log('✅ Profile created');
    console.log('\n📋 Test Agent Credentials:');
    console.log('Email:', testAgent.email);
    console.log('Password:', testAgent.password);
    console.log('User ID:', authData.user.id);
    console.log('\n⚠️  SAVE THESE CREDENTIALS!');

    // Save to a file so we don't lose them
    fs.writeFileSync(
      'cerberus-credentials.json',
      JSON.stringify({
        email: testAgent.email,
        password: testAgent.password,
        userId: authData.user.id
      }, null, 2)
    );

    console.log('\nCredentials saved to cerberus-credentials.json');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

provisionTestAgent();