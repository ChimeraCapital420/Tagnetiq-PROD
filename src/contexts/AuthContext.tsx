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

// This is the corrected list. Each item is on its own line
// and separated by a comma for clarity.
const ADMIN_EMAILS = [
  'admin@tagnetiq.com',
  'bidreaminvest77@gmail.com',
  // 'Samanthamccoy@yahoo.com', 
  // 'brock_a@hotmail.com',
  // 'brock-a@hotmail.com',
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // --- DEVELOPER SHORTCUT ---
    /*
    const sampleAdminUser = {
      id: 'a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890',
      email: 'admin@tagnetiq.com',
    };
    setUser(sampleAdminUser as any); 
    setSession({} as any);
    setIsAdmin(true);
    setLoading(false);
    */
    
    // --- PRODUCTION SUPABASE LOGIN CODE ---
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
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};