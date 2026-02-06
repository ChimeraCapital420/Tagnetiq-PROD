// FILE: src/components/authority/sections/PsaSection.tsx
// PSA (Graded Cards) authority data display
// v7.5 - Bulletproof data extraction with population report

'use client';

import React from 'react';
import { ExternalLink, Award, Users, TrendingUp, Shield, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage, formatDate } from '../helpers';
import { createFieldExtractor, getExternalUrl, getThumbnailUrl } from '../helpers';

// PSA Grade color mapping
const GRADE_COLORS: Record<string, string> = {
  '10': 'from-amber-500 to-yellow-400',
  '9.5': 'from-amber-400 to-yellow-300',
  '9': 'from-green-500 to-emerald-400',
  '8.5': 'from-green-400 to-emerald-300',
  '8': 'from-blue-500 to-cyan-400',
  '7.5': 'from-blue-400 to-cyan-300',
  '7': 'from-purple-500 to-violet-400',
  '6': 'from-orange-500 to-amber-400',
  '5': 'from-gray-500 to-slate-400',
  '4': 'from-gray-600 to-gray-500',
  '3': 'from-gray-700 to-gray-600',
  '2': 'from-gray-800 to-gray-700',
  '1': 'from-gray-900 to-gray-800',
};

// Grade descriptions
const GRADE_DESCRIPTIONS: Record<string, string> = {
  '10': 'Gem Mint',
  '9': 'Mint',
  '8': 'Near Mint-Mint',
  '7': 'Near Mint',
  '6': 'Excellent-Mint',
  '5': 'Excellent',
  '4': 'Very Good-Excellent',
  '3': 'Very Good',
  '2': 'Good',
  '1': 'Poor',
};

export const PsaSection: React.FC<SectionProps> = ({ data }) => {
  const get = createFieldExtractor(data);
  
  // Extract PSA-specific fields
  const thumbnail = getThumbnailUrl(data);
  const certNumber = get<string>('psaCertNumber') || get<string>('certNumber') || get<string>('certificationNumber');
  const grade = get<string>('grade');
  const gradeDescription = get<string>('gradeDescription');
  const cardYear = get<string>('cardYear') || get<string>('year');
  const cardBrand = get<string>('cardBrand') || get<string>('brand');
  const cardCategory = get<string>('cardCategory') || get<string>('category');
  const cardSubject = get<string>('cardSubject') || get<string>('subject') || get<string>('player');
  const cardNumber = get<string>('cardNumber') || get<string>('number');
  const variety = get<string>('cardVariety') || get<string>('variety');
  const setName = get<string>('setName') || get<string>('set');
  
  // Population report
  const totalPopulation = get<number>('totalPopulation') || get<number>('popTotal') || get<number>('pop');
  const populationHigher = get<number>('populationHigher') || get<number>('popHigher');
  const populationSameGrade = get<number>('populationSameGrade');
  
  // Label and certification info
  const labelType = get<string>('labelType');
  const isCrossedOver = get<boolean>('isCrossedOver');
  const certDate = get<string>('certDate') || get<string>('certificationDate');
  const specNumber = get<string>('specNumber');
  const specId = get<string>('specId');
  
  const marketValue = data.marketValue;
  const externalUrl = getExternalUrl(data) || get<string>('certUrl');

  const hasData = certNumber || cardYear || cardBrand || cardSubject || grade;
  
  // Calculate pop rarity
  const isLowPop = totalPopulation && totalPopulation < 100;
  const isVeryLowPop = totalPopulation && totalPopulation < 25;
  const isOnlyGrade = populationHigher === 0 && grade === '10';
  const isPop1 = totalPopulation === 1;
  
  // Get gradient for grade
  const gradeNum = grade?.replace(/[^0-9.]/g, '') || '5';
  const gradeGradient = GRADE_COLORS[gradeNum] || GRADE_COLORS['5'];
  const displayGradeDesc = gradeDescription || GRADE_DESCRIPTIONS[gradeNum];

  return (
    <div className="space-y-3">
      {/* Card Image */}
      {thumbnail && (
        <div className="flex justify-center">
          <ThumbnailImage
            src={thumbnail}
            alt={cardSubject || 'Graded card'}
            className="w-24 h-32 object-contain rounded shadow-lg"
          />
        </div>
      )}

      {/* PSA Grade Display */}
      {grade && (
        <div className="flex justify-center">
          <div className={`bg-gradient-to-br ${gradeGradient} text-white px-8 py-4 rounded-lg text-center shadow-lg`}>
            <p className="text-xs opacity-80 uppercase tracking-wider">PSA Grade</p>
            <p className="text-4xl font-bold">{grade}</p>
            {displayGradeDesc && (
              <p className="text-xs opacity-90">{displayGradeDesc}</p>
            )}
          </div>
        </div>
      )}

      {/* Cert Number */}
      {certNumber && (
        <p className="text-center text-xs font-mono text-muted-foreground">
          Cert #{certNumber}
        </p>
      )}

      {/* Card Subject/Player */}
      {cardSubject && (
        <p className="text-center text-sm font-semibold">{cardSubject}</p>
      )}

      {/* Set & Year */}
      {(setName || cardYear) && (
        <p className="text-center text-xs text-muted-foreground">
          {setName}{setName && cardYear && ' • '}{cardYear}
        </p>
      )}

      {/* Status Badges */}
      <div className="flex justify-center gap-2 flex-wrap">
        {labelType && labelType !== 'Regular' && (
          <Badge variant="secondary" className="text-xs">
            <Shield className="h-3 w-3 mr-1" />
            {labelType}
          </Badge>
        )}
        {isPop1 && (
          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
            <Award className="h-3 w-3 mr-1" />
            Pop 1
          </Badge>
        )}
        {isOnlyGrade && !isPop1 && (
          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
            <Award className="h-3 w-3 mr-1" />
            None Higher
          </Badge>
        )}
        {isVeryLowPop && !isPop1 && (
          <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30">
            <TrendingUp className="h-3 w-3 mr-1" />
            Very Low Pop
          </Badge>
        )}
        {isLowPop && !isVeryLowPop && !isPop1 && (
          <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
            <TrendingUp className="h-3 w-3 mr-1" />
            Low Pop
          </Badge>
        )}
        {isCrossedOver && (
          <Badge variant="outline" className="text-xs">
            Crossover
          </Badge>
        )}
      </div>

      {/* Population Report */}
      {(totalPopulation !== undefined || populationHigher !== undefined) && (
        <div className="bg-muted/50 rounded-md p-3">
          <div className="text-xs text-muted-foreground text-center mb-2">
            <Users className="h-3 w-3 inline mr-1" />
            Population Report
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">This Grade</p>
              <p className="font-bold text-lg">{totalPopulation?.toLocaleString() || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Higher Grades</p>
              <p className="font-bold text-lg">{populationHigher?.toLocaleString() || '-'}</p>
            </div>
          </div>
          {populationSameGrade !== undefined && populationSameGrade !== totalPopulation && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              Same grade population: {populationSameGrade.toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Market Value */}
      {marketValue && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-md p-3">
          <div className="text-xs text-muted-foreground text-center mb-2">Estimated Value</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Low</div>
              <div className="font-semibold text-red-500">{marketValue.low}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Mid</div>
              <div className="font-semibold text-green-500">{marketValue.mid}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">High</div>
              <div className="font-semibold text-blue-500">{marketValue.high}</div>
            </div>
          </div>
        </div>
      )}

      {/* Card Details */}
      {hasData && (
        <div className="grid grid-cols-2 gap-3">
          <DataRow label="Year" value={cardYear} />
          <DataRow label="Brand" value={cardBrand} />
          <DataRow label="Set" value={setName} />
          <DataRow label="Card #" value={cardNumber} />
          {variety && <DataRow label="Variety" value={variety} />}
          <DataRow label="Category" value={cardCategory} />
        </div>
      )}

      {/* Certification Date */}
      {certDate && (
        <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
          <Calendar className="h-3 w-3" />
          Certified: {formatDate(certDate)}
        </p>
      )}

      {/* No Data Fallback */}
      {!hasData && !grade && (
        <div className="text-center py-4">
          <Award className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Card verified but detailed info unavailable
          </p>
        </div>
      )}

      {/* External Link */}
      {externalUrl && (
        
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2"
        >
          Verify on PSA <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
};

export default PsaSection;