// FILE: src/hooks/useSignedUrl.ts
// Get signed URLs for private attachments - Mobile-first with aggressive caching

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// In-memory cache for signed URLs
const urlCache = new Map<string, { url: string; expires: number }>();

// Cache duration: 50 minutes (URLs valid for 60 min)
const CACHE_DURATION_MS = 50 * 60 * 1000;

// Normalize path - extract just the storage path from full URLs
function normalizePath(input: string): string {
  if (!input) return '';
  
  // If it's a full Supabase URL, extract just the path after bucket name
  const patterns = [
    /storage\/v1\/object\/public\/message-attachments\/(.+)$/,
    /storage\/v1\/object\/sign\/message-attachments\/(.+)$/,
    /storage\/v1\/object\/message-attachments\/(.+)$/,
    /message-attachments\/(.+)$/,
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      return match[1].split('?')[0]; // Remove query params
    }
  }
  
  // Clean up if it's just a path
  let cleaned = input;
  if (cleaned.startsWith('/')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('message-attachments/')) {
    cleaned = cleaned.replace('message-attachments/', '');
  }
  
  return cleaned;
}

export function useSignedUrl(rawPath: string | null | undefined, bucket?: string) {
  const { session } = useAuth();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Normalize the path once
  const path = rawPath ? normalizePath(rawPath) : null;

  useEffect(() => {
    // Cleanup previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!path || !session?.access_token) {
      setSignedUrl(null);
      setLoading(false);
      return;
    }

    // Check cache first
    const cacheKey = path;
    const cached = urlCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      setSignedUrl(cached.url);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fetchSignedUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/messages/attachment-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ path }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.url) {
          throw new Error('No URL in response');
        }

        // Cache the result
        urlCache.set(cacheKey, {
          url: data.url,
          expires: Date.now() + CACHE_DURATION_MS,
        });

        setSignedUrl(data.url);
        setError(null);
      } catch (err: any) {
        if (err.name === 'AbortError') return; // Ignore aborted requests
        
        console.error('Signed URL error:', err);
        setError(err.message || 'Failed to load attachment');
        setSignedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();

    return () => {
      controller.abort();
    };
  }, [path, session?.access_token]);

  // Manual refresh function
  const refresh = useCallback(() => {
    if (path) {
      urlCache.delete(path);
      setSignedUrl(null);
      setError(null);
    }
  }, [path]);

  return { signedUrl, loading, error, refresh };
}

// For multiple attachments at once - batched for efficiency
export function useSignedUrls(rawPaths: string[]) {
  const { session } = useAuth();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Normalize all paths
  const paths = rawPaths.map(normalizePath).filter(Boolean);

  useEffect(() => {
    if (!paths.length || !session?.access_token) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchUrls = async () => {
      setLoading(true);
      const newUrls: Record<string, string> = {};
      const newErrors: Record<string, string> = {};
      const pathsToFetch: string[] = [];

      // Check cache first for each path
      for (const path of paths) {
        const cached = urlCache.get(path);
        if (cached && cached.expires > Date.now()) {
          newUrls[path] = cached.url;
        } else {
          pathsToFetch.push(path);
        }
      }

      // Fetch uncached URLs in parallel (limit concurrency on mobile)
      const BATCH_SIZE = 3; // Mobile-friendly concurrency
      
      for (let i = 0; i < pathsToFetch.length; i += BATCH_SIZE) {
        const batch = pathsToFetch.slice(i, i + BATCH_SIZE);
        
        await Promise.all(
          batch.map(async (path) => {
            try {
              const response = await fetch('/api/messages/attachment-url', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ path }),
                signal: controller.signal,
              });

              if (response.ok) {
                const data = await response.json();
                if (data.url) {
                  urlCache.set(path, {
                    url: data.url,
                    expires: Date.now() + CACHE_DURATION_MS,
                  });
                  newUrls[path] = data.url;
                }
              } else {
                newErrors[path] = `HTTP ${response.status}`;
              }
            } catch (err: any) {
              if (err.name !== 'AbortError') {
                newErrors[path] = err.message;
              }
            }
          })
        );
      }

      setUrls(newUrls);
      setErrors(newErrors);
      setLoading(false);
    };

    fetchUrls();

    return () => {
      controller.abort();
    };
  }, [paths.join(','), session?.access_token]);

  return { urls, loading, errors };
}

// Clear cache (useful on logout)
export function clearSignedUrlCache() {
  urlCache.clear();
}