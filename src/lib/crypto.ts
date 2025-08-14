// FILE: src/lib/crypto.ts
// Provides functions for creating and verifying HMAC signatures for securing tracking links.

import { createHmac } from 'crypto';

const secret = process.env.BETA_HMAC_SECRET || 'default-beta-secret-for-local-dev';

if (process.env.NODE_ENV === 'production' && secret.startsWith('default')) {
  console.warn('Warning: Using default HMAC secret in production. Set BETA_HMAC_SECRET.');
}

export function createSignature(inviteId: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(inviteId);
  return hmac.digest('hex');
}

export function verifySignature(inviteId: string, signature: string): boolean {
  return createSignature(inviteId) === signature;
}