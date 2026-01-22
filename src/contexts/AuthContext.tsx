// FILE: src/contexts/AuthContext.tsx

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
// Import the single, authoritative Profile type
import { supabase, Profile } from '../lib/supabase'; 
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  updateProfile: (updates: Partial<Profile>) => void;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isDeveloper: boolean;
  isInvestor: boolean;
  isRetail: boolean;
  isUser: boolean;
  isOnboarded: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error, status } = await supabase
        .from('profiles')
        .select(`*`) 
        .eq('id', userId)
        .single();
        
      if (error && status !== 406) {
        throw error;
      }
      if (data) {
        setProfile(data as Profile);
      }
    } catch (error) {
      console.error('Error fetching profile:', (error as Error).message);
    }
  };

  const getSessionAndProfile = async () => {
    setLoading(true);
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('Error getting session:', sessionError);
      setLoading(false);
      return;
    }
    setSession(session);
    const currentUser = session?.user || null;
    setUser(currentUser);

    if (currentUser) {
      await fetchProfile(currentUser.id);
    }
    setLoading(false);
  };

  // Function to refresh profile data from database
  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user]);

  // Function to update profile locally (for optimistic updates)
  const updateProfile = useCallback((updates: Partial<Profile>) => {
    setProfile(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  useEffect(() => {
    getSessionAndProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (_event === 'SIGNED_IN' || _event === 'USER_UPDATED') {
        getSessionAndProfile();
      }
      if (_event === 'SIGNED_OUT') {
        setProfile(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const value = {
    session,
    user,
    profile,
    setProfile,
    updateProfile,
    loading,
    signOut,
    refreshProfile,
    isAdmin: profile?.role === 'admin',
    isDeveloper: profile?.role === 'developer',
    isInvestor: profile?.role === 'investor',
    isRetail: profile?.role === 'retail',
    isUser: profile?.role === 'user',
    isOnboarded: profile?.onboarding_complete ?? false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};