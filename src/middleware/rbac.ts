// FILE: src/middleware/rbac.ts
// A reusable role-based access control middleware for all API endpoints
// 
// NOTE: This is server-side middleware - runs in Vercel API routes
// Uses standard environment variables (no VITE_ prefix needed)

import { createClient } from '@supabase/supabase-js';
import type { Request, Response, NextFunction } from 'express';

// Server-side Supabase client
// Supports multiple env var naming conventions for compatibility
const supabaseUrl = 
  process.env.SUPABASE_URL || 
  process.env.VITE_SUPABASE_URL || 
  '';

const supabaseAnonKey = 
  process.env.SUPABASE_ANON_KEY || 
  process.env.VITE_SUPABASE_ANON_KEY || 
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('RBAC Middleware: Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Fetch user profile to get role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ error: 'User profile not found' });
    }

    req.user = {
      id: user.id,
      email: user.email!,
      role: profile.role
    };

    next();
  } catch (error) {
    console.error('RBAC authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Pre-configured role checks for common use cases
export const requireAdmin = requireRole(['admin']);
export const requireInvestor = requireRole(['investor', 'admin']);
export const requireBeta = requireRole(['user', 'retail', 'developer', 'investor', 'admin']);