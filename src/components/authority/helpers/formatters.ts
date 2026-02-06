// FILE: src/components/authority/helpers/formatters.ts
// Helper functions for formatting data display
// Refactored from monolith v7.3

/**
 * Format a date string for display
 */
export function formatDate(dateString: string | undefined): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format a price value
 */
export function formatPrice(value: number | undefined): string {
  if (value === undefined || value === null || isNaN(value)) return '';
  return `$${value.toFixed(2)}`;
}

/**
 * Format a number with locale formatting
 */
export function formatNumber(value: number | undefined): string {
  if (value === undefined || value === null || isNaN(value)) return '';
  return value.toLocaleString();
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string | undefined, maxLength: number = 150): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Format an array as comma-separated string
 */
export function formatArray(arr: string[] | undefined, maxItems: number = 5): string {
  if (!arr || arr.length === 0) return '';
  
  if (arr.length <= maxItems) {
    return arr.join(', ');
  }
  
  return arr.slice(0, maxItems).join(', ') + ` +${arr.length - maxItems} more`;
}

/**
 * Get year from date string
 */
export function extractYear(dateString: string | undefined): number | null {
  if (!dateString) return null;
  
  // Try to parse as date
  const date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    return date.getFullYear();
  }
  
  // Try to extract 4-digit year
  const match = dateString.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Smart retirement detection for LEGO sets
 */
export function isLegoSetRetired(
  year: number | undefined,
  isRetiredFlag: boolean | undefined,
  dateLastAvailable: string | undefined,
  availability: string | undefined
): boolean {
  const currentYear = new Date().getFullYear();
  
  return (
    isRetiredFlag === true ||
    !!dateLastAvailable ||
    availability === 'Retired' ||
    (year !== undefined && year < currentYear - 3)
  );
}

/**
 * Check if LEGO set is currently available
 */
export function isLegoSetCurrentlyAvailable(
  year: number | undefined,
  isRetired: boolean,
  availability: string | undefined
): boolean {
  const currentYear = new Date().getFullYear();
  
  return (
    !isRetired &&
    (availability === 'Retail' || availability === 'LEGO exclusive') &&
    year !== undefined &&
    year >= currentYear - 2
  );
}