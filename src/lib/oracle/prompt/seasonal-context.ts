// FILE: src/lib/oracle/prompt/seasonal-context.ts
// Injects seasonal market awareness into Oracle's system prompt
// Dash knows what's happening in the resale world RIGHT NOW
// Updated monthly patterns based on real resale market dynamics

export function buildSeasonalContext(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const day = now.getDate();

  const seasonalData = getSeasonalData(month, day);
  if (!seasonalData) return '';

  const sections: string[] = [];
  sections.push('## SEASONAL MARKET AWARENESS');
  sections.push(`Current period: ${seasonalData.period}`);
  sections.push(`\nMarket dynamics right now:\n${seasonalData.dynamics}`);

  if (seasonalData.hotCategories.length > 0) {
    sections.push(`\nHot categories this period: ${seasonalData.hotCategories.join(', ')}`);
  }

  if (seasonalData.buyingOpportunities.length > 0) {
    sections.push(`\nBuying opportunities: ${seasonalData.buyingOpportunities.join('; ')}`);
  }

  if (seasonalData.sellingTips.length > 0) {
    sections.push(`\nSelling tips: ${seasonalData.sellingTips.join('; ')}`);
  }

  sections.push('\nUse this context naturally — don\'t lecture about seasonality unless asked. Just factor it into recommendations.');

  return sections.join('\n');
}

// =============================================================================
// SEASONAL DATA BY MONTH
// =============================================================================

interface SeasonalData {
  period: string;
  dynamics: string;
  hotCategories: string[];
  buyingOpportunities: string[];
  sellingTips: string[];
}

function getSeasonalData(month: number, day: number): SeasonalData {
  const data: Record<number, SeasonalData> = {
    0: { // January
      period: 'Post-Holiday / New Year',
      dynamics: 'Holiday gift returns flood secondary markets. People declutter for New Year resolutions. Tax refund season approaching — buyers have cash in late Jan/Feb. Vintage and collectible prices often dip as holiday demand fades.',
      hotCategories: ['fitness equipment', 'organization/storage', 'self-improvement books', 'returned electronics'],
      buyingOpportunities: [
        'Post-holiday clearance at retail stores (up to 90% off)',
        'Gift card liquidation deals',
        'People selling holiday gifts they don\'t want',
        'Thrift stores restocked with donated holiday items',
      ],
      sellingTips: [
        'Fitness/diet items sell well in January (resolution buyers)',
        'Hold premium collectibles — prices recover by February',
        'List organizational items and storage solutions',
      ],
    },
    1: { // February
      period: 'Tax Refund Season / Valentine\'s',
      dynamics: 'Tax refunds hitting — buyers have disposable income. Valentine\'s Day drives jewelry, watches, luxury goods. Sports card market heating up with spring training approaching.',
      hotCategories: ['jewelry', 'watches', 'luxury goods', 'sports cards', 'gaming'],
      buyingOpportunities: [
        'Pre-Valentine\'s clearance on non-jewelry luxury items',
        'Estate sales (common post-holiday season)',
        'Sports card lots before baseball season hype',
      ],
      sellingTips: [
        'Price premium items higher — tax refund buyers are less price-sensitive',
        'Jewelry and watches peak demand around Feb 10-13',
        'Sports memorabilia starting to trend up',
      ],
    },
    2: { // March
      period: 'Spring Cleaning / March Madness',
      dynamics: 'Spring cleaning drives massive supply into thrift stores and garage sales. March Madness creates basketball memorabilia demand. Estate sale season begins in earnest.',
      hotCategories: ['basketball memorabilia', 'outdoor equipment', 'vintage clothing', 'home decor'],
      buyingOpportunities: [
        'Spring cleaning purges — thrift stores overflowing with quality items',
        'Early garage sales in warmer regions',
        'Storage unit auctions increase',
      ],
      sellingTips: [
        'Basketball cards and memorabilia peak during March Madness',
        'Start listing outdoor/garden items — demand is building',
        'Vintage spring clothing sells well',
      ],
    },
    3: { // April
      period: 'Garage Sale Season Begins / Tax Deadline',
      dynamics: 'Garage sale season in full swing. Tax deadline drives some distressed selling. Baseball season opens — card market active. Easter/spring break travel reduces competition.',
      hotCategories: ['baseball cards', 'garden/outdoor', 'vintage finds', 'toys', 'bikes'],
      buyingOpportunities: [
        'Peak garage sale sourcing — arrive early, bring cash',
        'Tax deadline distressed sellers (rare but valuable finds)',
        'Flea market season starting',
      ],
      sellingTips: [
        'Baseball cards and memorabilia demand is strong',
        'Outdoor toys and equipment sell fast',
        'List summer clothing and gear now — buyers shop ahead',
      ],
    },
    4: { // May
      period: 'Mother\'s Day / Pre-Summer',
      dynamics: 'Mother\'s Day drives jewelry, home decor, kitchen items. Pre-summer demand building for outdoor, beach, camping. Graduation season creates demand for electronics, luggage, dorm items.',
      hotCategories: ['jewelry', 'kitchen/home', 'outdoor gear', 'electronics', 'luggage'],
      buyingOpportunities: [
        'Post-Mother\'s Day clearance on home/kitchen items',
        'Last chance for spring garage sales before summer heat',
        'Graduating students selling textbooks, dorm items',
      ],
      sellingTips: [
        'Price Mother\'s Day items early in May',
        'Graduation gifts — electronics, watches, luggage',
        'Start listing camping/beach gear NOW',
      ],
    },
    5: { // June
      period: 'Summer / Father\'s Day / Graduation',
      dynamics: 'Father\'s Day drives tools, electronics, watches, outdoor. Kids out of school — toy and game demand shifts. Moving season creates supply and demand. Summer vacation = less competition online.',
      hotCategories: ['tools', 'watches', 'grills/outdoor cooking', 'video games', 'sports equipment'],
      buyingOpportunities: [
        'Moving sales — people liquidate when relocating',
        'End-of-school-year teacher/classroom sales',
        'Estate sales continue strong',
      ],
      sellingTips: [
        'Tools and outdoor equipment sell well for Father\'s Day',
        'Summer camp supplies and outdoor toys',
        'Less online competition — your listings get more visibility',
      ],
    },
    6: { // July
      period: 'Mid-Summer / 4th of July',
      dynamics: 'Slower period online — sellers on vacation. Great time to SOURCE heavily for Q4. Christmas in July clearance events. Collectible shows and conventions (SDCC, etc).',
      hotCategories: ['americana/patriotic items', 'outdoor/pool', 'convention exclusives', 'summer clearance'],
      buyingOpportunities: [
        'SOURCE NOW for Q4 — best buying period of the year',
        'Christmas in July clearances at retail',
        'Convention exclusives resale',
        'Vacation-related liquidations',
      ],
      sellingTips: [
        'Prices may be lower but volume can compensate',
        'Americana items spike around July 4th',
        'Start planning Q4 inventory strategy',
      ],
    },
    7: { // August
      period: 'Back to School / Late Summer',
      dynamics: 'Back-to-school drives massive demand for electronics, clothing, school supplies. Last month of summer sourcing before Q4. College students moving — supply and demand.',
      hotCategories: ['laptops/tablets', 'backpacks', 'clothing', 'dorm furnishings', 'school supplies'],
      buyingOpportunities: [
        'End-of-summer clearances (50-75% off)',
        'College students selling before moving',
        'Last big garage sale month before fall',
      ],
      sellingTips: [
        'Electronics for students — laptops, monitors, calculators',
        'Back-to-school clothing at all price points',
        'Start transitioning inventory to fall/Q4 items',
      ],
    },
    8: { // September
      period: 'Fall Transition / Football Season',
      dynamics: 'Football season drives sports memorabilia. Fall fashion transition. Q4 preparation should be in full swing. Labor Day sales create sourcing opportunities.',
      hotCategories: ['football memorabilia', 'fall fashion', 'halloween costumes/decor', 'vintage'],
      buyingOpportunities: [
        'Labor Day clearances — last major summer sales',
        'Start finding Halloween inventory',
        'Post-season baseball card price dips on non-playoff teams',
      ],
      sellingTips: [
        'Football cards and jerseys peak demand',
        'Start listing Halloween items by mid-September',
        'Fall clothing — sweaters, boots, jackets trending',
      ],
    },
    9: { // October
      period: 'Halloween / Pre-Holiday Prep',
      dynamics: 'Halloween drives costume and decor demand. Smart sellers prepping Q4 inventory for holiday rush. Collectible market building toward holiday gift-giving season.',
      hotCategories: ['halloween items', 'vintage costumes', 'horror collectibles', 'holiday prep'],
      buyingOpportunities: [
        'Post-Halloween clearance (buy for next year at 75-90% off)',
        'Final sourcing window for holiday inventory',
        'LEGO holiday sets releasing — limited editions',
      ],
      sellingTips: [
        'Halloween items sell at premium first 2 weeks of October',
        'Start listing holiday gifts and collectibles NOW',
        'Price testing for Q4 — the market tells you what it wants',
      ],
    },
    10: { // November
      period: 'Holiday Season / Black Friday / Cyber Monday',
      dynamics: 'THE selling season. Black Friday/Cyber Monday deals for sourcing AND selling. Collectible gift-giving peaks. Vintage and nostalgia items soar. Last chance for standard shipping.',
      hotCategories: ['toys', 'games', 'collectibles', 'electronics', 'LEGO', 'vintage', 'luxury gifts'],
      buyingOpportunities: [
        'Black Friday/Cyber Monday deals for retail arbitrage',
        'Clearance on non-holiday seasonal items',
        'Doorbuster deals on electronics for resale',
      ],
      sellingTips: [
        'PEAK SELLING SEASON — price aggressively, volume is key',
        'Gift-ready items command premium (include gift receipt option)',
        'Ship fast — buyers are deadline-driven',
        'Last standard shipping cutoff usually around Dec 15',
      ],
    },
    11: { // December
      period: 'Holiday Rush / Year-End',
      dynamics: 'First two weeks = frantic buying. After Dec 15 = last-minute shoppers pay premium. Post-Christmas = returns, gift card spending, New Year purges begin.',
      hotCategories: ['last-minute gifts', 'gift cards', 'electronics', 'toys', 'luxury items'],
      buyingOpportunities: [
        'Post-Christmas clearances (Dec 26-31) — source for next year',
        'Gift card liquidation begins',
        'People selling unwanted gifts immediately',
        'Year-end estate sales and moving sales',
      ],
      sellingTips: [
        'First 2 weeks: price at market, ship FAST',
        'After Dec 15: premium pricing for last-minute buyers',
        'Gift cards sell well on secondary market',
        'Start planning January strategy — new year, clean slate',
      ],
    },
  };

  return data[month] || data[0];
}
