// FILE: src/utils/test-signup.ts

import { supabase } from '@/lib/supabase';

export async function testSignupFlow() {
  console.log('Testing signup flow...');
  
  // Test 1: Check if we can connect to Supabase
  const { data: testConnection, error: connError } = await supabase
    .from('profiles')
    .select('count')
    .limit(1);
    
  if (connError) {
    console.error('Connection test failed:', connError);
    return;
  }
  console.log('✓ Connection successful');
  
  // Test 2: Try to create a test user
  const testEmail = `test-${Date.now()}@example.com`;
  const { data, error } = await supabase.auth.signUp({
    email: testEmail,
    password: 'testpass123',
  });
  
  if (error) {
    console.error('Signup test failed:', error);
    console.error('Full error object:', JSON.stringify(error, null, 2));
  } else {
    console.log('✓ Test user created:', data);
    
    // Check if profile was created
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', testEmail)
      .single();
      
    if (profileError) {
      console.error('Profile lookup failed:', profileError);
    } else {
      console.log('✓ Profile created:', profile);
    }
    
    // Clean up test user
    if (data.user) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(
        data.user.id
      );
      if (deleteError) {
        console.error('Cleanup failed:', deleteError);
      } else {
        console.log('✓ Test user cleaned up');
      }
    }
  }
}

// Run this in your browser console:
// testSignupFlow();