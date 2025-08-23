// FILE: src/hooks/useAuth.ts

import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js'; // CORRECTED: Import User type

// DEPRECATED: Local User interface has been removed.
// export interface User {
//   id: string;
//   email: string;
//   role: 'admin' | 'user';
//   fullName?: string;
// }

const sampleAdminUser: User = {
    id: 'a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890',
    email: 'admin@tagnetiq.com',
    app_metadata: {
        provider: 'email'
    },
    user_metadata: {
        fullName: 'Admin User'
    },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    role: 'admin',
};


export const useAuth = () => {
  const [user, setUser] = useState<User | null>(sampleAdminUser); // Default to admin for development
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const session = setTimeout(() => {
        setLoading(false);
    }, 500);
    return () => clearTimeout(session);
  }, []);

  return { user, loading };
};