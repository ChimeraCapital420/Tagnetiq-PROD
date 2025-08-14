// FILE: src/lib/investorAuth.ts
// Client-side helper to manage the investor invite token.

import Cookies from 'js-cookie';

const TOKEN_COOKIE_NAME = 'tq_invite_token';

/**
 * Gets the invite token from URL parameters or a cookie.
 * Prioritizes URL parameter for fresh visits.
 * @returns The token string or null if not found.
 */
export function getInvestorToken(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('t');

  if (tokenFromUrl) {
    // Save the token from the URL to a cookie for subsequent page loads
    Cookies.set(TOKEN_COOKIE_NAME, tokenFromUrl, { expires: 1 }); // Expires in 1 day
    return tokenFromUrl;
  }

  // If no token in URL, try to get it from the cookie
  return Cookies.get(TOKEN_COOKIE_NAME) || null;
}