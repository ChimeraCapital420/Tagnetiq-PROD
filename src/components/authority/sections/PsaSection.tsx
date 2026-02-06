// FILE: src/components/authority/sections/PsaSection.tsx
// PSA (graded cards) authority data display
// Refactored from monolith v7.3

'use client';

import React from 'react';
import { ExternalLink, Shield, Award } from 'lucide-react';
import type { SectionProps } from '../types';
import { DataRow } from '../helpers';

export const PsaSection: React.FC<SectionProps> = ({ data }) => {
  const details = (data.itemDetails || data) as typeof data;
  
  const psaCertNumber = details.psaCertNumber;
  const grade = details.grade;
  const gradeDescription = details.gradeDescription;
  const cardYear = details.cardYear;
  const cardBrand = details.cardBrand;
  const cardCategory = details.cardCategory;
  const cardSubject = details.cardSubject;
  const totalPopulation = details.totalPopulation;
  const populationHigher = details.populationHigher;
  const labelType = details.labelType;
  const externalUrl = details.externalUrl || data.externalUrl;

  // Grade color mapping
  const getGradeColor = (g: string | undefined): string => {
    if (!g) return 'bg-gray-200 text-gray-700';
    const numGrade = parseFloat(g);
    if (numGrade >= 10) return 'bg-emerald-500 text-white';
    if (numGrade >= 9) return 'bg-green-500 text-white';
    if (numGrade >= 8) return 'bg-blue-500 text-white';
    if (numGrade >= 7) return 'bg-yellow-500 text-black';
    if (numGrade >= 5) return 'bg-orange-500 text-white';
    return 'bg-red-500 text-white';
  };

  return (
    <div className="space-y-3">
      {/* PSA Grade Badge */}
      {grade && (
        <div className="flex justify-center">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${getGradeColor(grade)}`}>
            <Shield className="h-5 w-5" />
            <span className="text-xl font-bold">PSA {grade}</span>
          </div>
        </div>
      )}

      {/* Grade description */}
      {gradeDescription && (
        <p className="text-sm text-center text-muted-foreground">
          {gradeDescription}
        </p>
      )}

      {/* Cert number with verification link */}
      {psaCertNumber && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-2 text-center">
          <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">
            PSA Certification #
          </div>
          <div className="font-mono text-sm font-medium">{psaCertNumber}</div>
        </div>
      )}

      {/* Population data */}
      {(totalPopulation !== undefined || populationHigher !== undefined) && (
        <div className="bg-muted/50 rounded-md p-2">
          <div className="text-xs text-muted-foreground text-center mb-1 flex items-center justify-center gap-1">
            <Award className="h-3 w-3" />
            Population Report
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-sm">
            {totalPopulation !== undefined && (
              <div>
                <div className="text-muted-foreground text-xs">This Grade</div>
                <div className="font-medium">{totalPopulation.toLocaleString()}</div>
              </div>
            )}
            {populationHigher !== undefined && (
              <div>
                <div className="text-muted-foreground text-xs">Higher</div>
                <div className="font-medium">{populationHigher.toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Data grid */}
      <div className="grid grid-cols-2 gap-3">
        <DataRow label="Year" value={cardYear} />
        <DataRow label="Brand" value={cardBrand} />
        <DataRow label="Category" value={cardCategory} />
        <DataRow label="Subject" value={cardSubject} />
        <DataRow label="Label Type" value={labelType} />
      </div>

      {/* External link */}
      {(externalUrl || psaCertNumber) && (
        <a
          href={externalUrl || `https://www.psacard.com/cert/${psaCertNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Verify on PSA <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center">
        Data provided by PSA
      </p>
    </div>
  );
};

export default PsaSection;