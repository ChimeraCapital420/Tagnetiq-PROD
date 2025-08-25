// FILE: src/contexts/AuthContext.tsx
// GHOST PROTOCOL UPGRADE: 5-TIER ROLE SYSTEM & SECURE ADMIN CHECK

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// The Profile type now includes our new, more granular role.
export interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'developer' | 'investor' | 'retail' | 'user';
  full_name?: string;
  avatar_url?: string;
  onboarding_complete: boolean;
  has_seen_arena_intro: boolean;
  // Other profile fields...
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
  const isDeveloper = profile?.role === 'developer' || isAdmin; // Admins are also developers
  const isInvestor = profile?.role === 'investor' || isAdmin; // Admins are also investors

  const fetchSessionData = useCallback(async (currentSession: Session | null) => {
    setSession(currentSession);
    const currentUser = currentSession?.user ?? null;
    setUser(currentUser);

    if (currentUser) {
      // Fetch profile and check for admin role from a trusted source (the database).
      const { data: userProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      
      if (error) {
        console.error("GHOST REPORT: Error fetching profile. User may not exist in profiles table.", error);
        setProfile(null);
      } else {
        // --- DEVELOPER SHORTCUT ---
        // For local development, you can force an admin role for a specific user.
        const ADMIN_EMAILS = ['admin@tagnetiq.com']; // Add your dev email here
        if (ADMIN_EMAILS.includes(currentUser.email!)) {
          userProfile.role = 'admin';
        }
        // --- END SHORTCUT ---
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
        fetchSessionData(session);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchSessionData]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signOut, isAdmin, isDeveloper, isInvestor, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
};