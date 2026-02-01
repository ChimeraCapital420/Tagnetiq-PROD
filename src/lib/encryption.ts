// FILE: src/lib/encryption.ts
// End-to-end encryption for private messaging using Web Crypto API

const ALGORITHM = 'RSA-OAEP';
const HASH = 'SHA-256';
const KEY_LENGTH = 2048;

// Storage key for private key in IndexedDB
const PRIVATE_KEY_STORE = 'tagnetiq-private-key';
const DB_NAME = 'tagnetiq-encryption';
const DB_VERSION = 1;

// ============================================
// IndexedDB for secure private key storage
// ============================================

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys');
      }
    };
  });
}

async function storePrivateKey(userId: string, privateKey: CryptoKey): Promise<void> {
  const db = await openDatabase();
  const exported = await crypto.subtle.exportKey('jwk', privateKey);
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['keys'], 'readwrite');
    const store = transaction.objectStore('keys');
    const request = store.put(exported, `${PRIVATE_KEY_STORE}-${userId}`);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function getPrivateKey(userId: string): Promise<CryptoKey | null> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['keys'], 'readonly');
      const store = transaction.objectStore('keys');
      const request = store.get(`${PRIVATE_KEY_STORE}-${userId}`);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        if (!request.result) {
          resolve(null);
          return;
        }
        
        const privateKey = await crypto.subtle.importKey(
          'jwk',
          request.result,
          { name: ALGORITHM, hash: HASH },
          true,
          ['decrypt']
        );
        resolve(privateKey);
      };
    });
  } catch {
    return null;
  }
}

// ============================================
// Key Generation
// ============================================

export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: CryptoKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: ALGORITHM,
      modulusLength: KEY_LENGTH,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: HASH,
    },
    true,
    ['encrypt', 'decrypt']
  );

  // Export public key as base64 for storage in database
  const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));

  return {
    publicKey: publicKeyBase64,
    privateKey: keyPair.privateKey,
  };
}

export async function initializeEncryption(userId: string): Promise<string | null> {
  // Check if we already have a private key
  const existingKey = await getPrivateKey(userId);
  if (existingKey) {
    return null; // Already initialized
  }

  // Generate new key pair
  const { publicKey, privateKey } = await generateKeyPair();
  
  // Store private key locally (never sent to server)
  await storePrivateKey(userId, privateKey);
  
  // Return public key to be stored in database
  return publicKey;
}

export async function hasEncryptionKeys(userId: string): Promise<boolean> {
  const key = await getPrivateKey(userId);
  return key !== null;
}

// ============================================
// Encryption / Decryption
// ============================================

export async function encryptMessage(
  plaintext: string,
  recipientPublicKeyBase64: string
): Promise<string> {
  // Import recipient's public key
  const publicKeyBuffer = Uint8Array.from(atob(recipientPublicKeyBase64), c => c.charCodeAt(0));
  const publicKey = await crypto.subtle.importKey(
    'spki',
    publicKeyBuffer,
    { name: ALGORITHM, hash: HASH },
    false,
    ['encrypt']
  );

  // Encrypt the message
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM },
    publicKey,
    data
  );

  // Return as base64
  return btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
}

export async function decryptMessage(
  encryptedBase64: string,
  userId: string
): Promise<string> {
  const privateKey = await getPrivateKey(userId);
  if (!privateKey) {
    throw new Error('No private key found. Cannot decrypt message.');
  }

  // Decode from base64
  const encryptedBuffer = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

  // Decrypt
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM },
    privateKey,
    encryptedBuffer
  );

  // Decode to string
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

// ============================================
// For hybrid encryption (large messages/files)
// RSA can only encrypt small data, so we use AES for content
// and RSA to encrypt the AES key
// ============================================

export async function encryptLargeMessage(
  plaintext: string,
  recipientPublicKeyBase64: string
): Promise<{ encryptedContent: string; encryptedKey: string; iv: string }> {
  // Generate a random AES key for this message
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt content with AES
  const encoder = new TextEncoder();
  const encryptedContent = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoder.encode(plaintext)
  );

  // Export AES key and encrypt it with recipient's RSA public key
  const aesKeyBuffer = await crypto.subtle.exportKey('raw', aesKey);
  
  const publicKeyBuffer = Uint8Array.from(atob(recipientPublicKeyBase64), c => c.charCodeAt(0));
  const publicKey = await crypto.subtle.importKey(
    'spki',
    publicKeyBuffer,
    { name: ALGORITHM, hash: HASH },
    false,
    ['encrypt']
  );

  const encryptedKey = await crypto.subtle.encrypt(
    { name: ALGORITHM },
    publicKey,
    aesKeyBuffer
  );

  return {
    encryptedContent: btoa(String.fromCharCode(...new Uint8Array(encryptedContent))),
    encryptedKey: btoa(String.fromCharCode(...new Uint8Array(encryptedKey))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decryptLargeMessage(
  encryptedContent: string,
  encryptedKey: string,
  iv: string,
  userId: string
): Promise<string> {
  const privateKey = await getPrivateKey(userId);
  if (!privateKey) {
    throw new Error('No private key found. Cannot decrypt message.');
  }

  // Decrypt the AES key with our RSA private key
  const encryptedKeyBuffer = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0));
  const aesKeyBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM },
    privateKey,
    encryptedKeyBuffer
  );

  // Import the AES key
  const aesKey = await crypto.subtle.importKey(
    'raw',
    aesKeyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt the content
  const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const contentBuffer = Uint8Array.from(atob(encryptedContent), c => c.charCodeAt(0));
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    aesKey,
    contentBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

// ============================================
// Utility to clear keys (logout/account delete)
// ============================================

export async function clearEncryptionKeys(userId: string): Promise<void> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['keys'], 'readwrite');
      const store = transaction.objectStore('keys');
      const request = store.delete(`${PRIVATE_KEY_STORE}-${userId}`);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch {
    // Ignore errors during cleanup
  }
}