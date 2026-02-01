// FILE: src/hooks/useSignedUrl.ts
// Get signed URLs for private attachments

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const urlCache = new Map<string, { url: string; expires: number }>();

export function useSignedUrl(path: string | null | undefined) {
  const { session } = useAuth();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path || !session?.access_token) {
      setSignedUrl(null);
      return;
    }

    // Check cache (URLs valid for 1 hour, we cache for 50 min)
    const cached = urlCache.get(path);
    if (cached && cached.expires > Date.now()) {
      setSignedUrl(cached.url);
      return;
    }

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
        });

        if (!response.ok) {
          throw new Error('Failed to get attachment URL');
        }

        const data = await response.json();
        
        // Cache for 50 minutes
        urlCache.set(path, {
          url: data.url,
          expires: Date.now() + 50 * 60 * 1000,
        });

        setSignedUrl(data.url);
      } catch (err: any) {
        console.error('Signed URL error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [path, session?.access_token]);

  return { signedUrl, loading, error };
}

// For multiple attachments at once
export function useSignedUrls(paths: string[]) {
  const { session } = useAuth();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!paths.length || !session?.access_token) return;

    const fetchUrls = async () => {
      setLoading(true);
      const newUrls: Record<string, string> = {};

      await Promise.all(
        paths.map(async (path) => {
          // Check cache
          const cached = urlCache.get(path);
          if (cached && cached.expires > Date.now()) {
            newUrls[path] = cached.url;
            return;
          }

          try {
            const response = await fetch('/api/messages/attachment-url', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ path }),
            });

            if (response.ok) {
              const data = await response.json();
              urlCache.set(path, {
                url: data.url,
                expires: Date.now() + 50 * 60 * 1000,
              });
              newUrls[path] = data.url;
            }
          } catch (err) {
            console.error('Failed to get URL for:', path);
          }
        })
      );

      setUrls(newUrls);
      setLoading(false);
    };

    fetchUrls();
  }, [paths.join(','), session?.access_token]);

  return { urls, loading };
}