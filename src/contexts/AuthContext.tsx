// FILE: src/contexts/AuthContext.tsx

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
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

  const fetchProfile = async (userId: string, userEmail?: string): Promise<Profile | null> => {
    try {
      const { data, error, status } = await supabase
        .from('profiles')
        .select(`*`) 
        .eq('id', userId)
        .single();
        
      // Handle "no rows returned" - this is normal for new users
      if (error) {
        // PGRST116 = "no rows returned" from .single()
        if (error.code === 'PGRST116' || status === 406) {
          console.log('No profile found for user, creating one...');
          return await createDefaultProfile(userId, userEmail);
        }
        console.error('Error fetching profile:', error.message);
        return null;
      }
      
      return data as Profile;
    } catch (error) {
      console.error('Error in fetchProfile:', (error as Error).message);
      return null;
    }
  };

  // Create a default profile for new users
  const createDefaultProfile = async (userId: string, email?: string): Promise<Profile | null> => {
    try {
      const defaultProfile = {
        id: userId,
        email: email || null,
        role: 'user',
        onboarding_complete: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .insert(defaultProfile)
        .select()
        .single();

      if (error) {
        // If insert fails (maybe RLS or duplicate), try to fetch again
        console.error('Error creating profile:', error.message);
        
        // One more attempt to fetch - maybe it was created by a trigger
        const { data: retryData } = await supabase
          .from('profiles')
          .select(`*`)
          .eq('id', userId)
          .single();
          
        return retryData as Profile || null;
      }

      console.log('Created default profile for new user');
      return data as Profile;
    } catch (error) {
      console.error('Error in createDefaultProfile:', (error as Error).message);
      return null;
    }
  };

  const getSessionAndProfile = async () => {
    try {
      setLoading(true);
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Error getting session:', sessionError);
        return;
      }
      
      setSession(session);
      const currentUser = session?.user || null;
      setUser(currentUser);

      if (currentUser) {
        const profileData = await fetchProfile(currentUser.id, currentUser.email);
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Error in getSessionAndProfile:', error);
    } finally {
      // ALWAYS set loading to false, even if errors occur
      setLoading(false);
    }
  };

  // Function to refresh profile data from database
  const refreshProfile = useCallback(async () => {
    if (user) {
      const profileData = await fetchProfile(user.id, user.email);
      setProfile(profileData);
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
        setLoading(false);
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