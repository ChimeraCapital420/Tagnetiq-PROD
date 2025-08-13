export interface CategoryColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  border: string;
}

export const getCategoryColors = (categoryId: string | null): CategoryColorScheme => {
  if (!categoryId) {
    // Default purple theme
    return {
      primary: '#8b5cf6',
      secondary: '#a855f7',
      accent: '#10b981',
      background: '#1e293b',
      border: '#8b5cf6'
    };
  }

  const baseCategory = categoryId.split('-')[0];

  switch (baseCategory) {
    case 'vehicles':
      return {
        primary: '#ef4444', // Red
        secondary: '#f97316', // Orange
        accent: '#eab308', // Yellow
        background: '#1e293b',
        border: '#ef4444'
      };
    case 'lego':
      return {
        primary: '#3b82f6', // Blue
        secondary: '#06b6d4', // Cyan
        accent: '#10b981', // Green
        background: '#1e293b',
        border: '#3b82f6'
      };
    case 'starwars':
      return {
        primary: '#fbbf24', // Gold
        secondary: '#f59e0b', // Amber
        accent: '#dc2626', // Red
        background: '#1e293b',
        border: '#fbbf24'
      };
    case 'art':
      return {
        primary: '#a855f7', // Purple
        secondary: '#c084fc', // Light Purple
        accent: '#ec4899', // Pink
        background: '#1e293b',
        border: '#a855f7'
      };
    case 'books':
      return {
        primary: '#059669', // Emerald
        secondary: '#10b981', // Green
        accent: '#0891b2', // Cyan
        background: '#1e293b',
        border: '#059669'
      };
    case 'collectibles':
      return {
        primary: '#d97706', // Amber
        secondary: '#f59e0b', // Yellow
        accent: '#dc2626', // Red
        background: '#1e293b',
        border: '#d97706'
      };
    case 'sports':
      return {
        primary: '#16a34a', // Green
        secondary: '#22c55e', // Light Green
        accent: '#f59e0b', // Gold
        background: '#1e293b',
        border: '#16a34a'
      };
    case 'amazon':
      return {
        primary: '#ff9900', // Amazon Orange
        secondary: '#ffb84d', // Light Orange
        accent: '#232f3e', // Amazon Dark Blue
        background: '#1e293b',
        border: '#ff9900'
      };
    default:
      return {
        primary: '#8b5cf6',
        secondary: '#a855f7',
        accent: '#10b981',
        background: '#1e293b',
        border: '#8b5cf6'
      };
  }
};