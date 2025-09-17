// FILE: api/_lib/cache.ts
// Simple in-memory cache for Vercel serverless functions
// Note: This resets on cold starts. For production, use Redis or Upstash

interface CacheEntry<T> {
  data: T;
  expires: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(cleanupIntervalMs: number = 60000) {
    // Clean expired entries every minute
    this.startCleanup(cleanupIntervalMs);
  }

  private startCleanup(intervalMs: number) {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expires < now) {
          this.cache.delete(key);
        }
      }
    }, intervalMs);
  }

  set<T>(key: string, data: T, ttlSeconds: number = 60): void {
    const expires = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { data, expires });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  size(): number {
    return this.cache.size;
  }
}

// Export singleton instance
export const cache = new SimpleCache();

// Helper to generate cache keys
export function cacheKey(...parts: (string | number | undefined)[]): string {
  return parts.filter(p => p !== undefined).join(':');
}