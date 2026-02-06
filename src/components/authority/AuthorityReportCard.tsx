// FILE: src/components/authority/AuthorityReportCard.tsx
// Main Authority Report Card - Thin Orchestrator
// Refactored from 940-line monolith to ~150 lines
// v7.3 - Delegates to source-specific sections

'use client';

import React from 'react';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Import types, constants, and sections
import type { AuthorityData, AuthorityReportCardProps } from './types';
import { SOURCE_NAMES, SOURCE_ICONS, DEFAULT_ICON } from './constants';
import {
  GoogleBooksSection,
  NumistaSection,
  PokemonTcgSection,
  BricksetSection,
  ComicVineSection,
  DiscogsSection,
  RetailedSection,
  PsaSection,
  NhtsaSection,
  UpcItemDbSection,
} from './sections';

// Section component mapping
const SECTION_COMPONENTS: Record<string, React.FC<{ data: AuthorityData }>> = {
  google_books: GoogleBooksSection,
  numista: NumistaSection,
  pokemon_tcg: PokemonTcgSection,
  brickset: BricksetSection,
  comicvine: ComicVineSection,
  'Comic Vine': ComicVineSection,
  discogs: DiscogsSection,
  retailed: RetailedSection,
  streetwear: RetailedSection,  // v7.5 - uses same section as retailed
  psa: PsaSection,
  nhtsa: NhtsaSection,
  upcitemdb: UpcItemDbSection,
};

/**
 * Authority Report Card - displays verified data from authority sources
 * Each source has its own dedicated section component for isolation
 */
export const AuthorityReportCard: React.FC<AuthorityReportCardProps> = ({
  authorityData,
  className = '',
}) => {
  // Normalize source name
  const source = authorityData.source?.toLowerCase() || 'unknown';
  const displaySource = authorityData.source || 'unknown';
  
  // Get appropriate icon and name
  const IconComponent = SOURCE_ICONS[source] || SOURCE_ICONS[displaySource] || DEFAULT_ICON;
  const sourceName = SOURCE_NAMES[source] || SOURCE_NAMES[displaySource] || displaySource;
  
  // Get section component for this source
  const SectionComponent = SECTION_COMPONENTS[source] || SECTION_COMPONENTS[displaySource];
  
  // Confidence display
  const confidence = authorityData.confidence;
  const confidencePercent = confidence 
    ? (confidence > 1 ? confidence : Math.round(confidence * 100))
    : null;

  return (
    <Card className={`border-green-500/50 bg-green-500/5 ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <IconComponent className="h-5 w-5 text-green-600" />
            <span>Verified by {sourceName}</span>
          </CardTitle>
          <Badge variant="outline" className="bg-green-500/20 text-green-700 border-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Authority Verified
          </Badge>
        </div>
        
        {/* Confidence indicator */}
        {confidencePercent && (
          <p className="text-sm text-muted-foreground">
            Match Confidence: {confidencePercent}%
          </p>
        )}
      </CardHeader>

      <CardContent>
        {/* Render source-specific section */}
        {SectionComponent ? (
          <SectionComponent data={authorityData} />
        ) : (
          // Generic fallback for unknown sources
          <GenericSection data={authorityData} sourceName={sourceName} />
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Generic fallback section for unknown sources
 */
const GenericSection: React.FC<{ data: AuthorityData; sourceName: string }> = ({ 
  data, 
  sourceName 
}) => {
  return (
    <div className="space-y-3">
      {/* Title */}
      {data.title && (
        <p className="text-sm font-medium text-center">{data.title}</p>
      )}
      
      {/* Catalog number */}
      {data.catalogNumber && (
        <p className="text-xs text-muted-foreground text-center">
          Catalog #: {data.catalogNumber}
        </p>
      )}

      {/* Market value if available */}
      {data.marketValue && (
        <div className="bg-muted/50 rounded-md p-2">
          <div className="text-xs text-muted-foreground text-center mb-1">Market Value</div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Low</div>
              <div className="font-medium">{data.marketValue.low}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Mid</div>
              <div className="font-medium">{data.marketValue.mid}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">High</div>
              <div className="font-medium">{data.marketValue.high}</div>
            </div>
          </div>
        </div>
      )}

      {/* External link */}
      {data.externalUrl && (
        <a
          href={data.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          View on {sourceName} <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center">
        Data provided by {sourceName}
      </p>
    </div>
  );
};

export default AuthorityReportCard;