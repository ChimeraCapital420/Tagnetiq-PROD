// FILE: src/contexts/AuthContext.tsx (REPLACE THE ENTIRE FILE WITH THIS)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // --- DEVELOPER SHORTCUT ---
    // This code simulates a logged-in user to bypass the login screen.
    // To test as an admin, use sampleAdminUser.
    
    const sampleAdminUser = {
      id: 'a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890',
      email: 'admin@tagnetiq.com',
      // In a real app, role would come from user_metadata
    };

    // This line automatically "logs you in" as the admin user.
    setUser(sampleAdminUser as any); 

    setSession({} as any); // Set a dummy session to prevent errors
    setLoading(false);
    // --- END DEVELOPER SHORTCUT ---

    /*
    // --- ORIGINAL SUPABASE LOGIN CODE ---
    // To switch back to the real login system, delete the "DEVELOPER SHORTCUT"
    // code above and uncomment this block.

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
    */
  }, []);

  const signOut = async () => {
    // When using the shortcut, we just clear the user manually.
    setUser(null);
    setSession(null);
    // When using real Supabase, you would use this line:
    // await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};