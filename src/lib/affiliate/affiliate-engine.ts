// FILE: src/lib/affiliate/affiliate-engine.ts
// RH-011 — Affiliate Revenue Pipeline
// Wraps all outbound links through tracked affiliate URLs
// Every click on an authority link generates passive commission
//
// Revenue model:
//   eBay Partner Network:  1-4% of sale
//   Amazon Associates:     1-10% depending on category
//   StockX:                negotiated — ~3%
//   TCGPlayer:             3-5%
//   Discogs:               negotiated
//   GOAT:                  negotiated
//   Poshmark:              no affiliate program yet
//
// Usage:
//   import { buildAffiliateUrl, trackClick } from '@/lib/affiliate/affiliate-engine';
//   const url = buildAffiliateUrl('ebay', itemId, { query: 'vintage coin' });

export type AffiliatePartner =
  | 'ebay'
  | 'amazon'
  | 'stockx'
  | 'tcgplayer'
  | 'discogs'
  | 'goat'
  | 'whatnot'
  | 'poshmark'
  | 'grailed'
  | 'vestiaire'
  | 'depop'
  | 'realreal'
  | 'heritage_auctions'
  | 'pcgs'
  | 'ngc'
  | 'numista'
  | 'bricklink';

export interface AffiliateConfig {
  partner:         AffiliatePartner;
  displayName:     string;
  baseUrl:         string;
  affiliateParam:  string;
  affiliateId:     string | null;  // null = not yet enrolled
  commissionRate:  string;         // human-readable e.g. "1-4%"
  searchTemplate:  string;         // URL template with {query} placeholder
  isActive:        boolean;
}

// ─── Partner configurations ───────────────────────────────────────────────────
// affiliateId values come from env vars — set in Vercel
export const AFFILIATE_CONFIGS: Record<AffiliatePartner, AffiliateConfig> = {
  ebay: {
    partner:        'ebay',
    displayName:    'eBay',
    baseUrl:        'https://www.ebay.com',
    affiliateParam: 'mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid={id}&customid=tagnetiq&toolid=10001',
    affiliateId:    process.env.EBAY_AFFILIATE_CAMPAIGN_ID || null,
    commissionRate: '1-4%',
    searchTemplate: 'https://www.ebay.com/sch/i.html?_nkw={query}&LH_Complete=1&LH_Sold=1',
    isActive:       true,
  },
  amazon: {
    partner:        'amazon',
    displayName:    'Amazon',
    baseUrl:        'https://www.amazon.com',
    affiliateParam: 'tag={id}',
    affiliateId:    process.env.AMAZON_AFFILIATE_TAG || null,
    commissionRate: '1-10%',
    searchTemplate: 'https://www.amazon.com/s?k={query}',
    isActive:       true,
  },
  stockx: {
    partner:        'stockx',
    displayName:    'StockX',
    baseUrl:        'https://www.stockx.com',
    affiliateParam: 'utm_source=tagnetiq&utm_medium=affiliate',
    affiliateId:    process.env.STOCKX_AFFILIATE_ID || null,
    commissionRate: '~3%',
    searchTemplate: 'https://stockx.com/search?s={query}',
    isActive:       true,
  },
  tcgplayer: {
    partner:        'tcgplayer',
    displayName:    'TCGPlayer',
    baseUrl:        'https://www.tcgplayer.com',
    affiliateParam: 'partner=tagnetiq',
    affiliateId:    process.env.TCGPLAYER_AFFILIATE_ID || null,
    commissionRate: '3-5%',
    searchTemplate: 'https://www.tcgplayer.com/search/all/product?q={query}',
    isActive:       true,
  },
  discogs: {
    partner:        'discogs',
    displayName:    'Discogs',
    baseUrl:        'https://www.discogs.com',
    affiliateParam: 'utm_source=tagnetiq',
    affiliateId:    process.env.DISCOGS_AFFILIATE_ID || null,
    commissionRate: 'TBD',
    searchTemplate: 'https://www.discogs.com/search/?q={query}&type=all',
    isActive:       true,
  },
  goat: {
    partner:        'goat',
    displayName:    'GOAT',
    baseUrl:        'https://www.goat.com',
    affiliateParam: 'utm_source=tagnetiq&utm_medium=affiliate',
    affiliateId:    process.env.GOAT_AFFILIATE_ID || null,
    commissionRate: 'TBD',
    searchTemplate: 'https://www.goat.com/search?query={query}',
    isActive:       true,
  },
  whatnot: {
    partner:        'whatnot',
    displayName:    'Whatnot',
    baseUrl:        'https://www.whatnot.com',
    affiliateParam: 'utm_source=tagnetiq',
    affiliateId:    process.env.WHATNOT_AFFILIATE_ID || null,
    commissionRate: 'TBD',
    searchTemplate: 'https://www.whatnot.com/browse?query={query}',
    isActive:       true,
  },
  poshmark: {
    partner:        'poshmark',
    displayName:    'Poshmark',
    baseUrl:        'https://www.poshmark.com',
    affiliateParam: 'utm_source=tagnetiq',
    affiliateId:    null,  // no affiliate program yet
    commissionRate: 'N/A',
    searchTemplate: 'https://poshmark.com/search?q={query}',
    isActive:       true,
  },
  grailed: {
    partner:        'grailed',
    displayName:    'Grailed',
    baseUrl:        'https://www.grailed.com',
    affiliateParam: 'utm_source=tagnetiq',
    affiliateId:    null,
    commissionRate: 'TBD',
    searchTemplate: 'https://www.grailed.com/shop/grailed?query={query}',
    isActive:       true,
  },
  vestiaire: {
    partner:        'vestiaire',
    displayName:    'Vestiaire Collective',
    baseUrl:        'https://www.vestiairecollective.com',
    affiliateParam: 'utm_source=tagnetiq&utm_medium=affiliate',
    affiliateId:    process.env.VESTIAIRE_AFFILIATE_ID || null,
    commissionRate: 'TBD',
    searchTemplate: 'https://www.vestiairecollective.com/search/?q={query}',
    isActive:       true,
  },
  depop: {
    partner:        'depop',
    displayName:    'Depop',
    baseUrl:        'https://www.depop.com',
    affiliateParam: 'utm_source=tagnetiq',
    affiliateId:    null,
    commissionRate: 'TBD',
    searchTemplate: 'https://www.depop.com/search/?q={query}',
    isActive:       true,
  },
  realreal: {
    partner:        'realreal',
    displayName:    'The RealReal',
    baseUrl:        'https://www.therealreal.com',
    affiliateParam: 'utm_source=tagnetiq&utm_medium=affiliate',
    affiliateId:    process.env.REALREAL_AFFILIATE_ID || null,
    commissionRate: 'TBD',
    searchTemplate: 'https://www.therealreal.com/search#query={query}',
    isActive:       true,
  },
  heritage_auctions: {
    partner:        'heritage_auctions',
    displayName:    'Heritage Auctions',
    baseUrl:        'https://www.ha.com',
    affiliateParam: 'utm_source=tagnetiq',
    affiliateId:    null,
    commissionRate: 'TBD',
    searchTemplate: 'https://www.ha.com/c/search-results.zx?N=790+231+4294967271&Ntk=SI_LOTDESCRIPTION&Ntt={query}',
    isActive:       true,
  },
  pcgs: {
    partner:        'pcgs',
    displayName:    'PCGS',
    baseUrl:        'https://www.pcgs.com',
    affiliateParam: 'utm_source=tagnetiq',
    affiliateId:    null,
    commissionRate: 'N/A',
    searchTemplate: 'https://www.pcgs.com/coinfacts/search/{query}',
    isActive:       true,
  },
  ngc: {
    partner:        'ngc',
    displayName:    'NGC',
    baseUrl:        'https://www.ngccoin.com',
    affiliateParam: 'utm_source=tagnetiq',
    affiliateId:    null,
    commissionRate: 'N/A',
    searchTemplate: 'https://www.ngccoin.com/price-guide/united-states/{query}',
    isActive:       true,
  },
  numista: {
    partner:        'numista',
    displayName:    'Numista',
    baseUrl:        'https://en.numista.com',
    affiliateParam: 'utm_source=tagnetiq',
    affiliateId:    null,
    commissionRate: 'N/A',
    searchTemplate: 'https://en.numista.com/catalogue/index.php?et=&q={query}',
    isActive:       true,
  },
  bricklink: {
    partner:        'bricklink',
    displayName:    'BrickLink',
    baseUrl:        'https://www.bricklink.com',
    affiliateParam: 'utm_source=tagnetiq',
    affiliateId:    null,
    commissionRate: 'N/A',
    searchTemplate: 'https://www.bricklink.com/v2/search.page?q={query}',
    isActive:       true,
  },
};

// ─── Link builder ─────────────────────────────────────────────────────────────

export interface AffiliateLinkOptions {
  query?:      string;       // search query
  itemId?:     string;       // specific item ID on the platform
  category?:   string;       // category filter
  soldOnly?:   boolean;      // eBay sold listings only
  customPath?: string;       // override the search template entirely
}

/**
 * Build a tracked affiliate URL for a partner
 * If partner has no affiliate ID configured, returns the clean URL
 * (still useful for UX — affiliate ID can be added to Vercel later)
 */
export function buildAffiliateUrl(
  partner: AffiliatePartner,
  options: AffiliateLinkOptions = {}
): string {
  const config = AFFILIATE_CONFIGS[partner];
  if (!config) return '#';

  let url: string;

  if (options.customPath) {
    url = `${config.baseUrl}${options.customPath}`;
  } else if (options.query) {
    const encodedQuery = encodeURIComponent(options.query);
    url = config.searchTemplate.replace('{query}', encodedQuery);

    // eBay special: sold listings only
    if (partner === 'ebay' && options.soldOnly !== false) {
      if (!url.includes('LH_Sold')) {
        url += '&LH_Complete=1&LH_Sold=1';
      }
    }
  } else {
    url = config.baseUrl;
  }

  // Append affiliate tracking if ID is configured
  if (config.affiliateId) {
    const separator = url.includes('?') ? '&' : '?';
    const affiliateParams = config.affiliateParam.replace('{id}', config.affiliateId);
    url = `${url}${separator}${affiliateParams}`;
  }

  return url;
}

/**
 * Build all three StyleScan purchase lanes for a brand/item
 * Lane 1: Official retail
 * Lane 2: Resale market (eBay sold + luxury resale)
 * Lane 3: Budget substitute
 */
export interface StyleScanLanes {
  official:   { platform: string; url: string; label: string }[];
  resale:     { platform: string; url: string; label: string }[];
  substitute: { platform: string; url: string; label: string }[];
}

export function buildStyleScanLanes(
  itemName: string,
  brand: string,
  category: 'fashion' | 'sneakers' | 'handbags' | 'jewelry' | 'watches' | 'general'
): StyleScanLanes {
  const query = `${brand} ${itemName}`.trim();
  const brandOnly = brand;

  const lanes: StyleScanLanes = {
    official:   [],
    resale:     [],
    substitute: [],
  };

  // Lane 1 — Official retail (brand website + Amazon)
  const brandConfig = LUXURY_BRAND_ROUTER[brandOnly.toLowerCase()];
  if (brandConfig?.officialUrl) {
    lanes.official.push({
      platform: brandOnly,
      url:      `${brandConfig.officialUrl}/search?q=${encodeURIComponent(itemName)}`,
      label:    `Shop ${brandOnly} Official`,
    });
  }
  lanes.official.push({
    platform: 'Amazon',
    url:      buildAffiliateUrl('amazon', { query }),
    label:    'Find on Amazon',
  });

  // Lane 2 — Resale market
  lanes.resale.push({
    platform: 'eBay (Sold)',
    url:      buildAffiliateUrl('ebay', { query, soldOnly: true }),
    label:    'eBay Sold Listings',
  });

  if (category === 'sneakers') {
    lanes.resale.push(
      { platform: 'StockX', url: buildAffiliateUrl('stockx', { query }), label: 'StockX' },
      { platform: 'GOAT',   url: buildAffiliateUrl('goat',   { query }), label: 'GOAT' }
    );
  }

  if (category === 'handbags' || category === 'fashion') {
    lanes.resale.push(
      { platform: 'The RealReal',      url: buildAffiliateUrl('realreal',   { query }), label: 'The RealReal' },
      { platform: 'Vestiaire',         url: buildAffiliateUrl('vestiaire',  { query }), label: 'Vestiaire Collective' },
      { platform: 'Grailed',           url: buildAffiliateUrl('grailed',    { query }), label: 'Grailed' },
      { platform: 'Depop',             url: buildAffiliateUrl('depop',      { query }), label: 'Depop' },
    );
  }

  if (category === 'fashion' || category === 'general') {
    lanes.resale.push(
      { platform: 'Poshmark', url: buildAffiliateUrl('poshmark', { query }), label: 'Poshmark' },
    );
  }

  // Lane 3 — Budget substitute (eBay active listings + Amazon)
  lanes.substitute.push(
    {
      platform: 'eBay',
      url:      buildAffiliateUrl('ebay', { query: itemName }), // item without brand = cheaper options
      label:    'Similar on eBay',
    },
    {
      platform: 'Amazon',
      url:      buildAffiliateUrl('amazon', { query: itemName }),
      label:    'Similar on Amazon',
    }
  );

  return lanes;
}

/**
 * Track a click event for analytics
 * Call this when a user taps an affiliate link
 */
export async function trackAffiliateClick(
  partner:    AffiliatePartner,
  itemName:   string,
  scanId?:    string,
  userId?:    string
): Promise<void> {
  try {
    // Fire and forget — don't block the user navigation
    fetch('/api/affiliate/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partner,
        itemName,
        scanId,
        userId,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {}); // silent fail — never block user
  } catch {
    // silent fail
  }
}

/**
 * Get all configured (active + enrolled) affiliate partners
 */
export function getActiveAffiliatePartners(): AffiliateConfig[] {
  return Object.values(AFFILIATE_CONFIGS).filter(c => c.isActive && c.affiliateId);
}

/**
 * Get all partners (including unenrolled) for display
 */
export function getAllAffiliatePartners(): AffiliateConfig[] {
  return Object.values(AFFILIATE_CONFIGS).filter(c => c.isActive);
}

// ─── Luxury Brand Router ──────────────────────────────────────────────────────
// Used by StyleScan to route to official brand websites
// Keyed by lowercase brand name for case-insensitive matching
// This is RH-028's Brand Router — starts with top 100 luxury/fashion brands

export interface BrandConfig {
  displayName:    string;
  officialUrl:    string;
  category:       'luxury_handbags' | 'luxury_fashion' | 'sneakers' | 'streetwear' | 'fashion' | 'jewelry' | 'watches';
  resalePlatforms: AffiliatePartner[];
  hasNFC:         boolean;       // NFC/RFID authentication chip
  nfcSince?:      number;        // year NFC chips added
  priceRange:     'budget' | 'mid' | 'premium' | 'luxury' | 'ultra_luxury';
  isLuxury:       boolean;       // triggers RH-032 authentication prompt
}

export const LUXURY_BRAND_ROUTER: Record<string, BrandConfig> = {
  // ── Ultra Luxury ─────────────────────────────────────────────────────────
  'louis vuitton': { displayName: 'Louis Vuitton', officialUrl: 'https://us.louisvuitton.com', category: 'luxury_handbags', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: true, nfcSince: 2021, priceRange: 'ultra_luxury', isLuxury: true },
  'lv':            { displayName: 'Louis Vuitton', officialUrl: 'https://us.louisvuitton.com', category: 'luxury_handbags', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: true, nfcSince: 2021, priceRange: 'ultra_luxury', isLuxury: true },
  'chanel':        { displayName: 'Chanel', officialUrl: 'https://www.chanel.com', category: 'luxury_handbags', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: false, priceRange: 'ultra_luxury', isLuxury: true },
  'hermès':        { displayName: 'Hermès', officialUrl: 'https://www.hermes.com', category: 'luxury_handbags', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: false, priceRange: 'ultra_luxury', isLuxury: true },
  'hermes':        { displayName: 'Hermès', officialUrl: 'https://www.hermes.com', category: 'luxury_handbags', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: false, priceRange: 'ultra_luxury', isLuxury: true },
  'gucci':         { displayName: 'Gucci', officialUrl: 'https://www.gucci.com', category: 'luxury_handbags', resalePlatforms: ['realreal', 'vestiaire', 'grailed', 'ebay'], hasNFC: true, nfcSince: 2014, priceRange: 'ultra_luxury', isLuxury: true },
  'prada':         { displayName: 'Prada', officialUrl: 'https://www.prada.com', category: 'luxury_handbags', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: true, nfcSince: 2022, priceRange: 'ultra_luxury', isLuxury: true },
  'dior':          { displayName: 'Christian Dior', officialUrl: 'https://www.dior.com', category: 'luxury_handbags', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: true, nfcSince: 2022, priceRange: 'ultra_luxury', isLuxury: true },
  'christian dior': { displayName: 'Christian Dior', officialUrl: 'https://www.dior.com', category: 'luxury_handbags', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: true, nfcSince: 2022, priceRange: 'ultra_luxury', isLuxury: true },
  'saint laurent': { displayName: 'Saint Laurent', officialUrl: 'https://www.ysl.com', category: 'luxury_handbags', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: true, nfcSince: 2022, priceRange: 'ultra_luxury', isLuxury: true },
  'ysl':           { displayName: 'Saint Laurent', officialUrl: 'https://www.ysl.com', category: 'luxury_handbags', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: true, nfcSince: 2022, priceRange: 'ultra_luxury', isLuxury: true },
  'bottega veneta': { displayName: 'Bottega Veneta', officialUrl: 'https://www.bottegaveneta.com', category: 'luxury_handbags', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: true, nfcSince: 2022, priceRange: 'ultra_luxury', isLuxury: true },
  'fendi':         { displayName: 'Fendi', officialUrl: 'https://www.fendi.com', category: 'luxury_handbags', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: true, nfcSince: 2022, priceRange: 'ultra_luxury', isLuxury: true },
  'balenciaga':    { displayName: 'Balenciaga', officialUrl: 'https://www.balenciaga.com', category: 'luxury_fashion', resalePlatforms: ['grailed', 'depop', 'stockx', 'ebay'], hasNFC: true, nfcSince: 2022, priceRange: 'ultra_luxury', isLuxury: true },
  'givenchy':      { displayName: 'Givenchy', officialUrl: 'https://www.givenchy.com', category: 'luxury_fashion', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: false, priceRange: 'ultra_luxury', isLuxury: true },
  'valentino':     { displayName: 'Valentino', officialUrl: 'https://www.valentino.com', category: 'luxury_fashion', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: false, priceRange: 'ultra_luxury', isLuxury: true },
  'moncler':       { displayName: 'Moncler', officialUrl: 'https://www.moncler.com', category: 'luxury_fashion', resalePlatforms: ['grailed', 'depop', 'ebay'], hasNFC: true, nfcSince: 2016, priceRange: 'ultra_luxury', isLuxury: true },
  'burberry':      { displayName: 'Burberry', officialUrl: 'https://us.burberry.com', category: 'luxury_fashion', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: true, nfcSince: 2012, priceRange: 'luxury', isLuxury: true },
  'miu miu':       { displayName: 'Miu Miu', officialUrl: 'https://www.miumiu.com', category: 'luxury_handbags', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: true, nfcSince: 2023, priceRange: 'ultra_luxury', isLuxury: true },
  'celine':        { displayName: 'Celine', officialUrl: 'https://www.celine.com', category: 'luxury_handbags', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: false, priceRange: 'ultra_luxury', isLuxury: true },
  'loewe':         { displayName: 'Loewe', officialUrl: 'https://www.loewe.com', category: 'luxury_handbags', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: false, priceRange: 'ultra_luxury', isLuxury: true },
  'ferragamo':     { displayName: 'Salvatore Ferragamo', officialUrl: 'https://www.ferragamo.com', category: 'luxury_fashion', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: true, nfcSince: 2014, priceRange: 'luxury', isLuxury: true },
  'versace':       { displayName: 'Versace', officialUrl: 'https://www.versace.com', category: 'luxury_fashion', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: false, priceRange: 'luxury', isLuxury: true },
  'alexander mcqueen': { displayName: 'Alexander McQueen', officialUrl: 'https://www.alexandermcqueen.com', category: 'luxury_fashion', resalePlatforms: ['realreal', 'vestiaire', 'ebay'], hasNFC: false, priceRange: 'luxury', isLuxury: true },

  // ── Premium / Watches / Jewelry ───────────────────────────────────────────
  'rolex':         { displayName: 'Rolex', officialUrl: 'https://www.rolex.com', category: 'watches', resalePlatforms: ['ebay'], hasNFC: false, priceRange: 'ultra_luxury', isLuxury: true },
  'omega':         { displayName: 'Omega', officialUrl: 'https://www.omegawatches.com', category: 'watches', resalePlatforms: ['ebay'], hasNFC: false, priceRange: 'luxury', isLuxury: true },
  'cartier':       { displayName: 'Cartier', officialUrl: 'https://www.cartier.com', category: 'jewelry', resalePlatforms: ['realreal', 'ebay'], hasNFC: false, priceRange: 'ultra_luxury', isLuxury: true },
  'tiffany':       { displayName: 'Tiffany & Co.', officialUrl: 'https://www.tiffany.com', category: 'jewelry', resalePlatforms: ['realreal', 'ebay'], hasNFC: false, priceRange: 'luxury', isLuxury: true },

  // ── Premium Fashion ───────────────────────────────────────────────────────
  'ralph lauren':  { displayName: 'Ralph Lauren', officialUrl: 'https://www.ralphlauren.com', category: 'fashion', resalePlatforms: ['poshmark', 'ebay'], hasNFC: false, priceRange: 'premium', isLuxury: false },
  'tommy hilfiger': { displayName: 'Tommy Hilfiger', officialUrl: 'https://www.tommy.com', category: 'fashion', resalePlatforms: ['poshmark', 'ebay'], hasNFC: false, priceRange: 'premium', isLuxury: false },
  'calvin klein':  { displayName: 'Calvin Klein', officialUrl: 'https://www.calvinklein.com', category: 'fashion', resalePlatforms: ['poshmark', 'ebay'], hasNFC: false, priceRange: 'mid', isLuxury: false },
  'coach':         { displayName: 'Coach', officialUrl: 'https://www.coach.com', category: 'luxury_handbags', resalePlatforms: ['poshmark', 'ebay'], hasNFC: false, priceRange: 'premium', isLuxury: false },
  'kate spade':    { displayName: 'Kate Spade', officialUrl: 'https://www.katespade.com', category: 'luxury_handbags', resalePlatforms: ['poshmark', 'ebay'], hasNFC: false, priceRange: 'premium', isLuxury: false },
  'michael kors':  { displayName: 'Michael Kors', officialUrl: 'https://www.michaelkors.com', category: 'luxury_handbags', resalePlatforms: ['poshmark', 'ebay'], hasNFC: false, priceRange: 'premium', isLuxury: false },
  'tory burch':    { displayName: 'Tory Burch', officialUrl: 'https://www.toryburch.com', category: 'luxury_handbags', resalePlatforms: ['poshmark', 'ebay'], hasNFC: false, priceRange: 'premium', isLuxury: false },

  // ── Sneakers ──────────────────────────────────────────────────────────────
  'nike':          { displayName: 'Nike', officialUrl: 'https://www.nike.com', category: 'sneakers', resalePlatforms: ['stockx', 'goat', 'ebay'], hasNFC: false, priceRange: 'mid', isLuxury: false },
  'jordan':        { displayName: 'Air Jordan', officialUrl: 'https://www.nike.com/jordan', category: 'sneakers', resalePlatforms: ['stockx', 'goat', 'ebay'], hasNFC: false, priceRange: 'premium', isLuxury: false },
  'air jordan':    { displayName: 'Air Jordan', officialUrl: 'https://www.nike.com/jordan', category: 'sneakers', resalePlatforms: ['stockx', 'goat', 'ebay'], hasNFC: false, priceRange: 'premium', isLuxury: false },
  'adidas':        { displayName: 'Adidas', officialUrl: 'https://www.adidas.com', category: 'sneakers', resalePlatforms: ['stockx', 'goat', 'ebay'], hasNFC: false, priceRange: 'mid', isLuxury: false },
  'yeezy':         { displayName: 'Yeezy', officialUrl: 'https://www.adidas.com/us/yeezy', category: 'sneakers', resalePlatforms: ['stockx', 'goat', 'ebay'], hasNFC: false, priceRange: 'premium', isLuxury: false },
  'new balance':   { displayName: 'New Balance', officialUrl: 'https://www.newbalance.com', category: 'sneakers', resalePlatforms: ['stockx', 'goat', 'ebay'], hasNFC: false, priceRange: 'mid', isLuxury: false },
  'converse':      { displayName: 'Converse', officialUrl: 'https://www.converse.com', category: 'sneakers', resalePlatforms: ['ebay', 'stockx'], hasNFC: false, priceRange: 'mid', isLuxury: false },
  'vans':          { displayName: 'Vans', officialUrl: 'https://www.vans.com', category: 'sneakers', resalePlatforms: ['ebay'], hasNFC: false, priceRange: 'mid', isLuxury: false },
  'asics':         { displayName: 'ASICS', officialUrl: 'https://www.asics.com', category: 'sneakers', resalePlatforms: ['stockx', 'ebay'], hasNFC: false, priceRange: 'mid', isLuxury: false },
  'new balance 990': { displayName: 'New Balance 990', officialUrl: 'https://www.newbalance.com', category: 'sneakers', resalePlatforms: ['stockx', 'goat', 'ebay'], hasNFC: false, priceRange: 'premium', isLuxury: false },

  // ── Streetwear ────────────────────────────────────────────────────────────
  'supreme':       { displayName: 'Supreme', officialUrl: 'https://www.supremenewyork.com', category: 'streetwear', resalePlatforms: ['grailed', 'stockx', 'depop', 'ebay'], hasNFC: false, priceRange: 'premium', isLuxury: false },
  'palace':        { displayName: 'Palace', officialUrl: 'https://www.palaceskateboards.com', category: 'streetwear', resalePlatforms: ['grailed', 'depop', 'ebay'], hasNFC: false, priceRange: 'premium', isLuxury: false },
  'off-white':     { displayName: 'Off-White', officialUrl: 'https://www.off---white.com', category: 'streetwear', resalePlatforms: ['grailed', 'stockx', 'depop', 'ebay'], hasNFC: false, priceRange: 'luxury', isLuxury: true },
  'fear of god':   { displayName: 'Fear of God', officialUrl: 'https://fearofgod.com', category: 'streetwear', resalePlatforms: ['grailed', 'ebay'], hasNFC: false, priceRange: 'luxury', isLuxury: true },
  'essentials':    { displayName: 'Essentials (FOG)', officialUrl: 'https://fearofgod.com', category: 'streetwear', resalePlatforms: ['grailed', 'depop', 'ebay'], hasNFC: false, priceRange: 'premium', isLuxury: false },
  'stussy':        { displayName: 'Stussy', officialUrl: 'https://www.stussy.com', category: 'streetwear', resalePlatforms: ['grailed', 'depop', 'ebay'], hasNFC: false, priceRange: 'mid', isLuxury: false },
  'carhartt':      { displayName: 'Carhartt', officialUrl: 'https://www.carhartt.com', category: 'fashion', resalePlatforms: ['poshmark', 'ebay'], hasNFC: false, priceRange: 'mid', isLuxury: false },
  'carhartt wip':  { displayName: 'Carhartt WIP', officialUrl: 'https://www.carhartt-wip.com', category: 'streetwear', resalePlatforms: ['grailed', 'depop', 'ebay'], hasNFC: false, priceRange: 'premium', isLuxury: false },
};

/**
 * Detect if a scan result contains a luxury brand
 * Returns brand config if luxury brand found, null otherwise
 * Used by RH-032 to trigger authentication prompt
 */
export function detectLuxuryBrand(itemName: string): BrandConfig | null {
  const lower = itemName.toLowerCase();

  for (const [key, config] of Object.entries(LUXURY_BRAND_ROUTER)) {
    if (lower.includes(key)) {
      return config;
    }
  }

  return null;
}

/**
 * Check if brand has NFC authentication capability
 * Used to show NFC scan prompt vs visual-only auth
 */
export function brandHasNFC(brandName: string): { hasNFC: boolean; since?: number } {
  const config = LUXURY_BRAND_ROUTER[brandName.toLowerCase()];
  if (!config) return { hasNFC: false };
  return { hasNFC: config.hasNFC, since: config.nfcSince };
}

export default {
  buildAffiliateUrl,
  buildStyleScanLanes,
  trackAffiliateClick,
  detectLuxuryBrand,
  brandHasNFC,
  AFFILIATE_CONFIGS,
  LUXURY_BRAND_ROUTER,
};