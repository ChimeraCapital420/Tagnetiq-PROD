// FILE: api/_lib/security.ts (CREATE THIS NEW FILE)

import { supaAdmin } from './supaAdmin';
import type { VercelRequest } from '@vercel/node';
import { User } from '@supabase/supabase-js';

const ADMIN_EMAILS = ['admin@tagnetiq.com', 'bigdreaminvest77@gmail.com', 'Samanthamccoy@yahoo.com','Brock-a@hotmail.com','whitley.marc@gmail.com'];

/**
 * Verifies the JWT from the request, fetches the user, and checks if they are an admin.
 * Throws an error if the user is not authenticated or not an admin.
 * @param req The VercelRequest object.
 * @returns The authenticated admin user object.
 */
export async function verifyUserIsAdmin(req: VercelRequest): Promise<User> {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    throw new Error('Authentication token is required.');
  }

  const { data: { user }, error } = await supaAdmin.auth.getUser(token);

  if (error || !user) {
    throw new Error('Authentication error: Invalid token.');
  }

  if (!ADMIN_EMAILS.includes(user.email || '')) {
    throw new Error('Authorization error: User is not an admin.');
  }

  return user;
}