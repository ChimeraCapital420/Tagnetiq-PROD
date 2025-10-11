// FILE: api/user/preferences.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { supabase } from '../../src/lib/supabase';

export async function PATCH(req: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, settings')
      .eq('email', session.user.email)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get updates from request
    const updates = await req.json();

    // Merge settings
    const currentSettings = profile.settings || {};
    const newSettings = {
      ...currentSettings,
      ...updates
    };

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        settings: newSettings,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error('Error updating preferences:', updateError);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      settings: newSettings 
    });

  } catch (error) {
    console.error('Preferences API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('settings')
      .eq('email', session.user.email)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      settings: profile.settings || {} 
    });

  } catch (error) {
    console.error('Get preferences error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}