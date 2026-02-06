// FILE: src/components/authority/helpers/DataRow.tsx
// Reusable data row component for authority sections
// Refactored from monolith v7.3

import React from 'react';

interface DataRowProps {
  label: string;
  value: string | number | undefined | null;
  className?: string;
}

/**
 * Simple label/value row for authority data display
 */
export const DataRow: React.FC<DataRowProps> = ({ label, value, className = '' }) => {
  // Don't render if no value
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
};

export default DataRow;