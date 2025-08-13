// FILE: src/hooks/useAuth.ts (CREATE THIS NEW FILE)
// PURPOSE: Placeholder hook to simulate user authentication and role management.

import { useState, useEffect } from 'react';

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  fullName?: string;
}

const sampleAdminUser: User = {
    id: 'a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890',
    email: 'admin@tagnetiq.com',
    role: 'admin',
    fullName: 'Admin User'
};

const sampleStandardUser: User = {
    id: 'u1v2w3x4-y5z6-7890-u1v2-w3x4y5z67890',
    email: 'tester@tagnetiq.com',
    role: 'user',
    fullName: 'Beta Tester'
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