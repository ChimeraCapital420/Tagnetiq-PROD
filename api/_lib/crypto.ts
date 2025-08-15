// FILE: api/_lib/crypto.ts
import { createHmac } from 'crypto';

const secret = process.env.BETA_HMAC_SECRET || 'default-beta-secret-for-local-dev';

export function createSignature(inviteId: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(inviteId);
  return hmac.digest('hex');
}

export function verifySignature(inviteId: string, signature: string): boolean {
  return createSignature(inviteId) === signature;
}