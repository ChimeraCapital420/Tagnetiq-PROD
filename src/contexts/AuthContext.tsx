// FILE: src/contexts/AuthContext.tsx
// GHOST PROTOCOL UPGRADE: 5-TIER ROLE SYSTEM & SECURE ADMIN CHECK

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Define AppRole Type
export type AppRole = 'admin' | 'developer' | 'investor' | 'retail' | 'user';

// The Profile type now includes our new, more granular role.
export interface Profile {
  id: string;
  email: string;
  role: AppRole;
  screen_name: string;
  mfa_enrolled: boolean;
  full_name?: string;
  avatar_url?: string;
  onboarding_complete: boolean;
  has_seen_arena_intro: boolean;
  settings: {
    tts_enabled: boolean;
    tts_voice_uri: string | null;
  };
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  // Role-based accessors for clarity throughout the application
  isAdmin: boolean;
  isDeveloper: boolean;
  isInvestor: boolean;
  isRetail: boolean;
  isUser: boolean;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  signOut: async () => {},
  isAdmin: false,
  isDeveloper: false,
  isInvestor: false,
  isRetail: false,
  isUser: false,
  setProfile: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Derived role states for easy access
  const isAdmin = profile?.role === 'admin';
  const isDeveloper = profile?.role === 'developer';
  const isInvestor = profile?.role === 'investor';
  const isRetail = profile?.role === 'retail';
  const isUser = profile?.role === 'user';


  const fetchSessionData = useCallback(async (currentSession: Session | null) => {
    setSession(currentSession);
    const currentUser = currentSession?.user ?? null;
    setUser(currentUser);

    if (currentUser) {
      // Fetch profile and check for admin role from a trusted source (the database).
      const { data: userProfile, error } = await supabase
        .from('profiles')
        .select('id, email, role, screen_name, mfa_enrolled, full_name, avatar_url, onboarding_complete, has_seen_arena_intro, settings, created_at, updated_at')
        .eq('id', currentUser.id)
        .single();
      
      if (error) {
        console.error("GHOST REPORT: Error fetching profile. User may not exist in profiles table.", error);
        setProfile(null);
      } else {
        setProfile(userProfile as Profile);
      }
    } else {
      setProfile(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchSessionData(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (_event === 'SIGNED_IN' || _event === 'USER_UPDATED') {
            fetchSessionData(session);
        }
        fetchSessionData(session);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchSessionData]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
      user,
      profile,
      session,
      loading,
      signOut,
      isAdmin,
      isDeveloper,
      isInvestor,
      isRetail,
      isUser,
      setProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};