// FILE: src/components/authority/sections/UpcItemDbSection.tsx
// UPCitemdb (Barcodes) authority data display
// v7.5 - Bulletproof data extraction - FULL VERSION

'use client';

import React from 'react';
import { ExternalLink, Package, Barcode, Tag, DollarSign, Building, Palette, Ruler, Scale } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage, formatPrice, truncateText } from '../helpers';
import { createFieldExtractor, getExternalUrl, getThumbnailUrl } from '../helpers';

export const UpcItemDbSection: React.FC<SectionProps> = ({ data }) => {
  const get = createFieldExtractor(data);
  
  // Extract barcode-specific fields
  const thumbnail = getThumbnailUrl(data) || get<string>('image') || get<string>('images')?.[0];
  const images = get<string[]>('images');
  
  // Product identification
  const title = get<string>('title') || get<string>('name');
  const brand = get<string>('brand');
  const manufacturer = get<string>('manufacturer');
  const model = get<string>('model') || get<string>('mpn');
  const asin = get<string>('asin');
  
  // Barcodes
  const upc = get<string>('upc') || get<string>('barcode');
  const ean = get<string>('ean');
  const gtin = get<string>('gtin');
  
  // Description and category
  const description = get<string>('description');
  const category = get<string>('category');
  const categoryPath = get<string[]>('categoryPath');
  
  // Physical attributes
  const color = get<string>('color');
  const size = get<string>('size');
  const weight = get<string>('weight');
  const dimension = get<string>('dimension');
  const dimensions = get<{ length?: string; width?: string; height?: string }>('dimensions');
  const material = get<string>('material');
  
  // Pricing
  const msrp = get<number>('msrp');
  const lowestPrice = get<number>('lowestPrice') || get<number>('lowest_recorded_price');
  const highestPrice = get<number>('highestPrice') || get<number>('highest_recorded_price');
  const currency = get<string>('currency') || 'USD';
  
  // Offers/stores
  const offers = get<Array<{ merchant: string; price: number; link: string }>>('offers');
  const storesCount = get<number>('stores_count');
  
  // Additional info
  const ingredients = get<string>('ingredients');
  const features = get<string[]>('features');
  const specifications = get<Record<string, string>>('specifications');
  
  const marketValue = data.marketValue;
  const externalUrl = getExternalUrl(data);

  const hasData = brand || upc || ean || category;
  const hasBarcodes = upc || ean || gtin;
  const hasPricing = msrp || lowestPrice || highestPrice || marketValue;
  const hasPhysicalAttrs = color || size || weight || dimension;

  return (
    <div className="space-y-3">
      {/* Product Image */}
      {thumbnail && (
        <div className="flex justify-center">
          <ThumbnailImage
            src={thumbnail}
            alt={title || 'Product'}
            className="w-24 h-24 object-contain rounded"
          />
        </div>
      )}

      {/* Brand & Title */}
      {(brand || title) && (
        <div className="text-center">
          {brand && (
            <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center justify-center gap-1">
              <Building className="h-3 w-3" />
              {brand}
            </p>
          )}
          {title && data.title !== title && (
            <p className="text-sm font-semibold">{title}</p>
          )}
        </div>
      )}

      {/* Barcode Display */}
      {hasBarcodes && (
        <div className="bg-muted/50 rounded-md p-3">
          <div className="flex justify-center gap-4 flex-wrap">
            {upc && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Barcode className="h-3 w-3" />
                  UPC
                </p>
                <p className="font-mono text-sm">{upc}</p>
              </div>
            )}
            {ean && ean !== upc && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Barcode className="h-3 w-3" />
                  EAN
                </p>
                <p className="font-mono text-sm">{ean}</p>
              </div>
            )}
            {gtin && gtin !== upc && gtin !== ean && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Barcode className="h-3 w-3" />
                  GTIN
                </p>
                <p className="font-mono text-sm">{gtin}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Path */}
      {categoryPath && categoryPath.length > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          {categoryPath.join(' › ')}
        </p>
      )}

      {/* Status Badges */}
      <div className="flex justify-center gap-2 flex-wrap">
        {category && !categoryPath && (
          <Badge variant="outline" className="text-xs">
            <Tag className="h-3 w-3 mr-1" />
            {category}
          </Badge>
        )}
        {color && (
          <Badge variant="secondary" className="text-xs">
            <Palette className="h-3 w-3 mr-1" />
            {color}
          </Badge>
        )}
        {size && (
          <Badge variant="secondary" className="text-xs">
            <Ruler className="h-3 w-3 mr-1" />
            {size}
          </Badge>
        )}
      </div>

      {/* MSRP Display */}
      {msrp && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-2 text-center">
          <p className="text-xs text-muted-foreground">Manufacturer's Suggested Price</p>
          <p className="text-lg font-bold text-blue-500">{formatPrice(msrp)}</p>
        </div>
      )}

      {/* Market Value / Price Range */}
      {hasPricing && !msrp && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-md p-3">
          <div className="text-xs text-muted-foreground text-center mb-2">
            Market Value
            {storesCount && <span className="ml-1">({storesCount} stores)</span>}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Low</div>
              <div className="font-semibold text-red-500">
                {marketValue?.low || (lowestPrice ? formatPrice(lowestPrice) : '-')}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Mid</div>
              <div className="font-semibold text-green-500">
                {marketValue?.mid || '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">High</div>
              <div className="font-semibold text-blue-500">
                {marketValue?.high || (highestPrice ? formatPrice(highestPrice) : '-')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Store Offers */}
      {offers && offers.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground text-center">Available at:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {offers.slice(0, 4).map((offer, i) => (
              
                key={i}
                href={offer.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80 transition-colors"
              >
                {offer.merchant}: {formatPrice(offer.price)}
              </a>
            ))}
            {offers.length > 4 && (
              <span className="text-xs text-muted-foreground">+{offers.length - 4} more</span>
            )}
          </div>
        </div>
      )}

      {/* Description */}
      {description && (
        <p className="text-xs text-muted-foreground text-center">
          {truncateText(description, 200)}
        </p>
      )}

      {/* Features */}
      {features && features.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <p className="font-medium mb-1">Features:</p>
          <ul className="list-disc list-inside">
            {features.slice(0, 4).map((feature, i) => (
              <li key={i} className="truncate">{feature}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Data Grid */}
      {hasData && (
        <div className="grid grid-cols-2 gap-3">
          <DataRow label="Brand" value={brand} />
          <DataRow label="Manufacturer" value={manufacturer} />
          <DataRow label="Model" value={model} />
          <DataRow label="Category" value={category} />
          <DataRow label="Color" value={color} />
          <DataRow label="Size" value={size} />
          <DataRow label="Weight" value={weight} />
          <DataRow label="Material" value={material} />
          {asin && <DataRow label="ASIN" value={asin} />}
        </div>
      )}

      {/* Dimensions */}
      {dimensions && (
        <p className="text-xs text-center text-muted-foreground">
          Dimensions: {dimensions.length} × {dimensions.width} × {dimensions.height}
        </p>
      )}

      {/* Ingredients (for food/cosmetics) */}
      {ingredients && (
        <div className="text-xs text-muted-foreground">
          <p className="font-medium mb-1">Ingredients:</p>
          <p className="line-clamp-2">{ingredients}</p>
        </div>
      )}

      {/* No Data Fallback */}
      {!hasData && !thumbnail && (
        <div className="text-center py-4">
          <Package className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Product verified but detailed info unavailable
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
          View Product Details <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
};

export default UpcItemDbSection;