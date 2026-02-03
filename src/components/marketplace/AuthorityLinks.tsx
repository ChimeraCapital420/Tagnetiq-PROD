// FILE: src/components/marketplace/AuthorityLinks.tsx
// NEW: Reusable component for displaying authority source links
// Preserves Numista, Google Books, Colnect, and other authority references
// Mobile-first: touch-friendly buttons with proper spacing

import React from 'react';
import { ExternalLink, BookOpen, Coins, Stamp, Database, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Authority source configuration
interface AuthoritySource {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const AUTHORITY_SOURCES: Record<string, AuthoritySource> = {
  numista: {
    key: 'numista_url',
    label: 'Numista',
    icon: Coins,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 hover:bg-amber-500/20',
  },
  googlebooks: {
    key: 'googlebooks_url',
    label: 'Google Books',
    icon: BookOpen,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 hover:bg-blue-500/20',
  },
  colnect: {
    key: 'colnect_url',
    label: 'Colnect',
    icon: Stamp,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/20',
  },
  tcgplayer: {
    key: 'tcgplayer_url',
    label: 'TCGPlayer',
    icon: Database,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 hover:bg-purple-500/20',
  },
  psacard: {
    key: 'psa_url',
    label: 'PSA',
    icon: Database,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 hover:bg-red-500/20',
  },
  beckett: {
    key: 'beckett_url',
    label: 'Beckett',
    icon: Database,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10 hover:bg-orange-500/20',
  },
  generic: {
    key: 'authority_url',
    label: 'Source',
    icon: Globe,
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/10 hover:bg-zinc-500/20',
  },
};

interface AuthorityLinksProps {
  // Can pass individual URLs
  numista_url?: string | null;
  googlebooks_url?: string | null;
  colnect_url?: string | null;
  tcgplayer_url?: string | null;
  psa_url?: string | null;
  beckett_url?: string | null;
  authority_url?: string | null;
  
  // Or pass the whole item object
  item?: {
    numista_url?: string | null;
    googlebooks_url?: string | null;
    colnect_url?: string | null;
    tcgplayer_url?: string | null;
    psa_url?: string | null;
    beckett_url?: string | null;
    authority_url?: string | null;
    authoritySource?: string | null;
    [key: string]: unknown;
  };
  
  // Display options
  variant?: 'compact' | 'full' | 'inline';
  showLabels?: boolean;
  className?: string;
}

export const AuthorityLinks: React.FC<AuthorityLinksProps> = ({
  numista_url,
  googlebooks_url,
  colnect_url,
  tcgplayer_url,
  psa_url,
  beckett_url,
  authority_url,
  item,
  variant = 'compact',
  showLabels = true,
  className,
}) => {
  // Merge individual props with item props
  const urls = {
    numista_url: numista_url || item?.numista_url,
    googlebooks_url: googlebooks_url || item?.googlebooks_url,
    colnect_url: colnect_url || item?.colnect_url,
    tcgplayer_url: tcgplayer_url || item?.tcgplayer_url,
    psa_url: psa_url || item?.psa_url,
    beckett_url: beckett_url || item?.beckett_url,
    authority_url: authority_url || item?.authority_url,
  };

  // Build list of available links
  const availableLinks = Object.entries(AUTHORITY_SOURCES)
    .filter(([key]) => {
      const urlKey = AUTHORITY_SOURCES[key].key as keyof typeof urls;
      return urls[urlKey];
    })
    .map(([key, config]) => ({
      ...config,
      url: urls[config.key as keyof typeof urls] as string,
    }));

  // No links to show
  if (availableLinks.length === 0) {
    return null;
  }

  // Inline variant - just text links
  if (variant === 'inline') {
    return (
      <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
        {availableLinks.map((link) => (
          <a
            key={link.key}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-1 text-xs touch-manipulation',
              link.color,
              'hover:underline'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-2.5 w-2.5" />
            {link.label}
          </a>
        ))}
      </div>
    );
  }

  // Compact variant - small icon buttons
  if (variant === 'compact') {
    return (
      <div className={cn('flex flex-wrap gap-1.5', className)}>
        {availableLinks.map((link) => {
          const Icon = link.icon;
          return (
            <a
              key={link.key}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs',
                'touch-manipulation transition-colors',
                link.bgColor,
                link.color
              )}
              onClick={(e) => e.stopPropagation()}
              title={`View on ${link.label}`}
            >
              <Icon className="h-3 w-3" />
              {showLabels && <span>{link.label}</span>}
              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
            </a>
          );
        })}
      </div>
    );
  }

  // Full variant - larger buttons
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {availableLinks.map((link) => {
        const Icon = link.icon;
        return (
          <Button
            key={link.key}
            variant="outline"
            size="sm"
            asChild
            className={cn(
              'h-9 touch-manipulation',
              link.bgColor,
              link.color,
              'border-0'
            )}
          >
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <Icon className="h-4 w-4 mr-1.5" />
              {link.label}
              <ExternalLink className="h-3 w-3 ml-1.5 opacity-60" />
            </a>
          </Button>
        );
      })}
    </div>
  );
};

// Hook to extract authority data from analysis results
// Use this when creating listings to preserve authority links
export function extractAuthorityData(analysisResult: Record<string, unknown>): {
  numista_url?: string;
  googlebooks_url?: string;
  colnect_url?: string;
  tcgplayer_url?: string;
  psa_url?: string;
  beckett_url?: string;
  authority_url?: string;
  authoritySource?: string;
} {
  const authorityData: Record<string, string> = {};
  
  // Check common authority URL fields
  const urlFields = [
    'numista_url', 'numistaUrl', 'numista_link',
    'googlebooks_url', 'googlebooksUrl', 'google_books_url',
    'colnect_url', 'colnectUrl', 'colnect_link',
    'tcgplayer_url', 'tcgplayerUrl',
    'psa_url', 'psaUrl',
    'beckett_url', 'beckettUrl',
    'authority_url', 'authorityUrl', 'source_url', 'sourceUrl',
  ];
  
  for (const field of urlFields) {
    const value = analysisResult[field];
    if (typeof value === 'string' && value.startsWith('http')) {
      // Normalize field name
      const normalizedKey = field
        .replace(/Url$/, '_url')
        .replace(/Link$/, '_url')
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '')
        .replace(/__/g, '_');
      
      authorityData[normalizedKey] = value;
    }
  }
  
  // Extract authority source name
  const sourceFields = ['authoritySource', 'authority_source', 'source', 'dataSource'];
  for (const field of sourceFields) {
    const value = analysisResult[field];
    if (typeof value === 'string' && value.length > 0) {
      authorityData.authoritySource = value;
      break;
    }
  }
  
  return authorityData;
}

export default AuthorityLinks;