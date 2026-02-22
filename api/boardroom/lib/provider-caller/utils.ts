// FILE: api/boardroom/lib/provider-caller/utils.ts
// ═══════════════════════════════════════════════════════════════════════
// GATEWAY UTILITIES
// ═══════════════════════════════════════════════════════════════════════
//
// Shared utility functions used across all provider implementations.
// fetchWithTimeout is the backbone of every external API call.
//
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fetch with AbortController-based timeout.
 * Clean up on completion or abort.
 * Includes response body in error for debugging.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      // Read body for error details (but cap length)
      const errorBody = await response.text().catch(() => '');
      const truncated = errorBody.substring(0, 300);
      throw new Error(`HTTP ${response.status}: ${truncated}`);
    }

    return response;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}