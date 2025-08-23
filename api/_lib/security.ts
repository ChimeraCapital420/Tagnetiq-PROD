// FILE: api/_lib/security.ts

import { supaAdmin } from './supaAdmin';
import type { VercelRequest } from '@vercel/node';
import { User } from '@supabase/supabase-js';

/**
 * Verifies the JWT from the request and fetches the user.
 * Throws an error if the user is not authenticated.
 * @param req The VercelRequest object.
 * @returns The authenticated user object.
 */
export async function verifyUser(req: VercelRequest): Promise<User> {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    throw new Error('Authentication error: Token is required.');
  }

  const { data: { user }, error } = await supaAdmin.auth.getUser(token);

  if (error || !user) {
    throw new Error('Authentication error: Invalid token.');
  }
  return user;
}


/**
 * Verifies the user is authenticated AND has the 'admin' role in the database.
 * Throws an error if authentication fails or the user is not an admin.
 * @param req The VercelRequest object.
 * @returns The authenticated admin user object.
 */
export async function verifyUserIsAdmin(req: VercelRequest): Promise<User> {
    const user = await verifyUser(req);

    const { data: profile, error } = await supaAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (error) {
        throw new Error('Authorization error: Could not verify user role.');
    }

    if (profile.role !== 'admin') {
        throw new Error('Authorization error: User does not have admin privileges.');
    }

    return user;
}