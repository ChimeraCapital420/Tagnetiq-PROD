// FILE: src/contexts/AuthContext.tsx (REVISED TO EXPOSE PROFILE REFRESH)

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>; // EXPOSED FUNCTION
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  signOut: async () => {},
  isAdmin: false,
  refreshProfile: async () => {}, // DEFAULT FUNCTION
});

export const useAuth = () => useContext(AuthContext);

const ADMIN_EMAILS = ['admin@tagnetiq.com', 'bigdreaminvest77@gmail.com', 'Samanthamccoy@yahoo.com','Brock-a@hotmail.com','whitley.marc@gmail.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchProfile = useCallback(async (currentUser: User | null) => {
    if (currentUser) {
      const { data: userProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
      }
      setProfile(userProfile);
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setIsAdmin(currentUser ? ADMIN_EMAILS.includes(currentUser.email || '') : false);
        await fetchProfile(currentUser);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };
  
  // NEW FUNCTION TO MANUALLY RE-FETCH PROFILE
  const refreshProfile = async () => {
      if (user) {
          await fetchProfile(user);
      }
  }

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signOut, isAdmin, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};