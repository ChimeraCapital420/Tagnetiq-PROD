// FILE: src/contexts/AuthContext.tsx (REVISED TO EXPOSE setProfile)

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
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>; // EXPOSED SETTER
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  signOut: async () => {},
  isAdmin: false,
  setProfile: () => {}, // DEFAULT SETTER
});

export const useAuth = () => useContext(AuthContext);

const ADMIN_EMAILS = ['admin@tagnetiq.com', 'bigdreaminvest77@gmail.com', 'Samanthamccoy@yahoo.com','Brock-a@hotmail.com','whitley.marc@gmail.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchProfile = async (currentUser: User | null) => {
      if (currentUser) {
        const { data: userProfile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (error) console.error("Error fetching profile:", error);
        setProfile(userProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    };
    
    // Initial session fetch
    supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setIsAdmin(currentUser ? ADMIN_EMAILS.includes(currentUser.email || '') : false);
        fetchProfile(currentUser);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setIsAdmin(currentUser ? ADMIN_EMAILS.includes(currentUser.email || '') : false);
        fetchProfile(currentUser);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signOut, isAdmin, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
};