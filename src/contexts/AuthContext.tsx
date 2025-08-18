// FILE: src/contexts/AuthContext.tsx (REPLACE THE ENTIRE FILE WITH THIS)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '@/lib/supabase'; // Import Profile type

interface AuthContextType {
  user: User | null;
  profile: Profile | null; // Add profile to the context
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  signOut: async () => {},
  isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

const ADMIN_EMAILS = ['admin@tagnetiq.com', 'bigdreaminvest77@gmail.com', 'Samanthamccoy@yahoo.com','Brock-a@hotmail.com','whitley.marc@gmail.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null); // State for profile
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setIsAdmin(currentUser ? ADMIN_EMAILS.includes(currentUser.email || '') : false);

        if (currentUser) {
          // If a user is logged in, fetch their profile
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
          // If no user, clear the profile
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signOut, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};