// FILE: src/hooks/useEncryption.ts
// Hook to manage E2E encryption for messaging

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  initializeEncryption,
  hasEncryptionKeys,
  encryptLargeMessage,
  decryptLargeMessage,
} from '@/lib/encryption';

interface RecipientKey {
  userId: string;
  publicKey: string;
}

const keyCache = new Map<string, string>();

export function useEncryption() {
  const { user, session } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize encryption on first load
  useEffect(() => {
    if (!user?.id || !session?.access_token) return;

    const init = async () => {
      setIsInitializing(true);
      setError(null);

      try {
        // Check if we have local keys
        const hasKeys = await hasEncryptionKeys(user.id);
        
        if (hasKeys) {
          setIsInitialized(true);
          setIsInitializing(false);
          return;
        }

        // Generate new keys
        const publicKey = await initializeEncryption(user.id);
        
        if (publicKey) {
          // Save public key to server
          const response = await fetch('/api/users/encryption-key', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ publicKey }),
          });

          if (!response.ok) {
            const data = await response.json();
            // 409 means key already exists (another device set it up)
            if (response.status !== 409) {
              throw new Error(data.error || 'Failed to save encryption key');
            }
          }
        }

        setIsInitialized(true);
      } catch (err: any) {
        console.error('Encryption init error:', err);
        setError(err.message);
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, [user?.id, session?.access_token]);

  // Get recipient's public key
  const getRecipientKey = useCallback(async (recipientId: string): Promise<string | null> => {
    if (!session?.access_token) return null;

    // Check cache
    if (keyCache.has(recipientId)) {
      return keyCache.get(recipientId)!;
    }

    try {
      const response = await fetch(`/api/users/encryption-key?userId=${recipientId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (data.publicKey) {
        keyCache.set(recipientId, data.publicKey);
        return data.publicKey;
      }
      return null;
    } catch {
      return null;
    }
  }, [session?.access_token]);

  // Encrypt a message
  const encrypt = useCallback(async (
    plaintext: string,
    recipientId: string
  ): Promise<{ encrypted: string; key: string; iv: string } | null> => {
    if (!isInitialized) {
      console.warn('Encryption not initialized');
      return null;
    }

    const publicKey = await getRecipientKey(recipientId);
    if (!publicKey) {
      console.warn('Recipient has no encryption key');
      return null;
    }

    try {
      const result = await encryptLargeMessage(plaintext, publicKey);
      return {
        encrypted: result.encryptedContent,
        key: result.encryptedKey,
        iv: result.iv,
      };
    } catch (err) {
      console.error('Encryption error:', err);
      return null;
    }
  }, [isInitialized, getRecipientKey]);

  // Decrypt a message
  const decrypt = useCallback(async (
    encryptedContent: string,
    encryptedKey: string,
    iv: string
  ): Promise<string | null> => {
    if (!user?.id) return null;

    try {
      return await decryptLargeMessage(encryptedContent, encryptedKey, iv, user.id);
    } catch (err) {
      console.error('Decryption error:', err);
      return null;
    }
  }, [user?.id]);

  return {
    isInitialized,
    isInitializing,
    error,
    encrypt,
    decrypt,
    getRecipientKey,
  };
}