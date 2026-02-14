// FILE: src/components/analysis/utils/safe-helpers.ts
// Ultra-defensive helpers for safely extracting data from API responses.
// Cannot crash on any malformed data.

export const safeString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
};

export const safeNumber = (value: unknown, defaultValue = 0): number => {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) return parsed;
  }
  return defaultValue;
};

export const safeArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value;
  return [];
};