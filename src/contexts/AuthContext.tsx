// FILE: src/contexts/AuthContext.tsx (REPLACE THE ENTIRE FILE WITH THIS)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

const ADMIN_EMAILS = ['admin@tagnetiq.com', 'your-email@example.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // --- DEVELOPER SHORTCUT ---
    // This code simulates a logged-in admin user to bypass the login screen.
    console.log("DEV MODE: Bypassing Supabase login with admin user.");
    
    const sampleAdminUser = {
      id: 'a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890',
      email: 'admin@tagnetiq.com',
    };

    setUser(sampleAdminUser as any);
    setSession({} as any);
    setIsAdmin(true); // Force admin status
    setLoading(false);
    // --- END DEVELOPER SHORTCUT ---

    /*
    // --- ORIGINAL SUPABASE LOGIN CODE ---
    // To switch back to the real login system, comment out or delete the "DEVELOPER SHORTCUT"
    // block above and uncomment this block.

    console.log("PRODUCTION MODE: Using Supabase for authentication.");
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setIsAdmin(currentUser ? ADMIN_EMAILS.includes(currentUser.email || '') : false);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setIsAdmin(currentUser ? ADMIN_EMAILS.includes(currentUser.email || '') : false);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
    */
  }, []);

  const signOut = async () => {
    // For the shortcut, we just clear the state.
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    console.log("DEV MODE: Signed out.");
    
    // For real Supabase auth, you would use this line:
    // await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};