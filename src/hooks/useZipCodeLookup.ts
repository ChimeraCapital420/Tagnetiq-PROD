// FILE: src/hooks/useZipCodeLookup.ts
// NEW: Reusable hook for ZIP code lookup and auto-fill
// Uses Zippopotam.us API (free, no API key required)
// Mobile-first: optimized for quick data entry

import { useState, useCallback, useEffect, useRef } from 'react';

// Zippopotam.us API response type
interface ZipLookupResponse {
  'post code': string;
  country: string;
  'country abbreviation': string;
  places: Array<{
    'place name': string;
    longitude: string;
    state: string;
    'state abbreviation': string;
    latitude: string;
  }>;
}

interface ZipLookupResult {
  city: string;
  state: string;
  stateAbbreviation: string;
  latitude: string;
  longitude: string;
  country: string;
}

interface UseZipCodeLookupOptions {
  /** Country code for lookup (default: 'us') */
  country?: 'us' | 'de' | 'at' | 'ch' | 'nl' | 'be' | 'fr' | 'es' | 'pt' | 'it' | 'pl' | 'cz' | 'se' | 'no' | 'fi' | 'dk' | 'ca' | 'mx' | 'br' | 'in' | 'jp' | 'au';
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
  /** Auto-lookup when ZIP reaches valid length */
  autoLookup?: boolean;
  /** Callback when lookup succeeds */
  onSuccess?: (result: ZipLookupResult) => void;
  /** Callback when lookup fails */
  onError?: (error: string) => void;
}

interface UseZipCodeLookupReturn {
  /** Current ZIP code value */
  zipCode: string;
  /** Set ZIP code value */
  setZipCode: (zip: string) => void;
  /** City from lookup */
  city: string;
  /** Set city manually */
  setCity: (city: string) => void;
  /** State abbreviation from lookup */
  state: string;
  /** Set state manually */
  setState: (state: string) => void;
  /** Full state name from lookup */
  stateFull: string;
  /** Whether a lookup is in progress */
  isLoading: boolean;
  /** Error message if lookup failed */
  error: string | null;
  /** Full lookup result */
  result: ZipLookupResult | null;
  /** Trigger manual lookup */
  lookup: (zip?: string) => Promise<ZipLookupResult | null>;
  /** Clear all values */
  clear: () => void;
  /** Combined location string (City, ST ZIP) */
  locationString: string;
  /** Whether we have a valid location */
  hasLocation: boolean;
}

// ZIP code length requirements by country
const ZIP_LENGTHS: Record<string, number> = {
  us: 5,
  de: 5,
  at: 4,
  ch: 4,
  nl: 4,
  be: 4,
  fr: 5,
  es: 5,
  pt: 4,
  it: 5,
  pl: 5,
  cz: 5,
  se: 5,
  no: 4,
  fi: 5,
  dk: 4,
  ca: 6, // Alphanumeric
  mx: 5,
  br: 8,
  in: 6,
  jp: 7,
  au: 4,
};

export function useZipCodeLookup(options: UseZipCodeLookupOptions = {}): UseZipCodeLookupReturn {
  const {
    country = 'us',
    debounceMs = 300,
    autoLookup = true,
    onSuccess,
    onError,
  } = options;

  const [zipCode, setZipCodeInternal] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [stateFull, setStateFull] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ZipLookupResult | null>(null);
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Get required ZIP length for country
  const requiredLength = ZIP_LENGTHS[country] || 5;

  // Perform the actual API lookup
  const lookup = useCallback(async (zip?: string): Promise<ZipLookupResult | null> => {
    const zipToLookup = zip || zipCode;
    
    // Validate ZIP format
    const cleanZip = country === 'ca' 
      ? zipToLookup.replace(/\s/g, '').toUpperCase()
      : zipToLookup.replace(/\D/g, '');
    
    if (cleanZip.length !== requiredLength) {
      return null;
    }

    // Cancel any pending request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.zippopotam.us/${country}/${cleanZip}`,
        { signal: abortRef.current.signal }
      );

      if (!response.ok) {
        if (response.status === 404) {
          const errorMsg = 'ZIP code not found';
          setError(errorMsg);
          onError?.(errorMsg);
          return null;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data: ZipLookupResponse = await response.json();

      if (data.places && data.places.length > 0) {
        const place = data.places[0];
        const lookupResult: ZipLookupResult = {
          city: place['place name'],
          state: place['state abbreviation'],
          stateAbbreviation: place['state abbreviation'],
          latitude: place.latitude,
          longitude: place.longitude,
          country: data['country abbreviation'],
        };

        setCity(lookupResult.city);
        setState(lookupResult.stateAbbreviation);
        setStateFull(place.state);
        setResult(lookupResult);

        // Haptic feedback on mobile
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }

        onSuccess?.(lookupResult);
        return lookupResult;
      }

      return null;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      console.warn('[useZipCodeLookup] Error:', err);
      const errorMsg = 'Failed to lookup ZIP code';
      setError(errorMsg);
      onError?.(errorMsg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [zipCode, country, requiredLength, onSuccess, onError]);

  // Handle ZIP code changes with auto-lookup
  const setZipCode = useCallback((zip: string) => {
    // Clean input based on country format
    const cleanZip = country === 'ca'
      ? zip.replace(/[^a-zA-Z0-9\s]/g, '').toUpperCase().slice(0, 7)
      : zip.replace(/\D/g, '').slice(0, requiredLength);
    
    setZipCodeInternal(cleanZip);

    // Clear city/state if ZIP is incomplete
    if (cleanZip.length < requiredLength) {
      setCity('');
      setState('');
      setStateFull('');
      setResult(null);
      setError(null);
    }

    // Auto-lookup when ZIP reaches valid length
    if (autoLookup && cleanZip.length === requiredLength) {
      // Debounce the lookup
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        lookup(cleanZip);
      }, debounceMs);
    }
  }, [country, requiredLength, autoLookup, debounceMs, lookup]);

  // Clear all values
  const clear = useCallback(() => {
    setZipCodeInternal('');
    setCity('');
    setState('');
    setStateFull('');
    setResult(null);
    setError(null);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  // Computed values
  const locationString = city && state 
    ? `${city}, ${state} ${zipCode}`.trim()
    : zipCode;
  
  const hasLocation = !!(city && state);

  return {
    zipCode,
    setZipCode,
    city,
    setCity,
    state,
    setState,
    stateFull,
    isLoading,
    error,
    result,
    lookup,
    clear,
    locationString,
    hasLocation,
  };
}

export default useZipCodeLookup;

// Re-export types for consumers
export type { ZipLookupResult, UseZipCodeLookupOptions, UseZipCodeLookupReturn };