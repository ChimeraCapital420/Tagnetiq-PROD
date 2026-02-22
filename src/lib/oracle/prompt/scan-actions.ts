// FILE: src/lib/oracle/prompt/scan-actions.ts
// ═══════════════════════════════════════════════════════════════════════
// Scan Actions — On-Device Actionable Suggestions Engine
// ═══════════════════════════════════════════════════════════════════════
//
// Generates context-aware action suggestions that Oracle can weave
// into conversation naturally. Zero LLM cost — pure template logic.
//
// Categories of actions:
//   1. VAULT    — Store, update inventory, track value over time
//   2. GRADE    — Get professional grading (PSA, NGC, PCGS, CGC, etc.)
//   3. LIST     — Where to sell (eBay, Mercari, StockX, Heritage, etc.)
//   4. RESEARCH — Go deeper (history, user manual, comparable sales)
//   5. PROTECT  — Insurance, preservation, authentication
//   6. CONNECT  — Local pros, clubs, shows, events
//
// Oracle is instructed to pick 1-2 most relevant actions per scan,
// not dump the full list. The engine provides ranked suggestions
// and Oracle uses its judgment.
//
// All actions are REVERSIBLE — vault additions can be removed when
// items are sold/used/destroyed. Inventory PDF stays current.
// ═══════════════════════════════════════════════════════════════════════

// =============================================================================
// TYPES
// =============================================================================

export interface ScanAction {
  /** Unique action key */
  id: string;
  /** Human-friendly label Oracle can use */
  label: string;
  /** Natural phrasing Oracle can adapt */
  suggestion: string;
  /** Priority: higher = more relevant (1-100) */
  priority: number;
  /** Category of action */
  type: 'vault' | 'grade' | 'list' | 'research' | 'protect' | 'connect';
}

export interface ScanActionContext {
  /** The scan's analysis_result */
  result: any;
  /** Whether item is already in vault */
  inVault: boolean;
  /** Whether item has been listed */
  isListed: boolean;
  /** User's vault items (to check for duplicates, collection gaps) */
  vaultItems: any[];
  /** Scan category */
  category: string;
  /** Estimated value */
  estimatedValue: number;
  /** Decision (BUY/PASS/HOLD) */
  decision: string;
  /** Confidence (0-100) */
  confidence: number;
}

// =============================================================================
// MAIN EXPORT — Generate ranked actions for a scan
// =============================================================================

/**
 * Generate ranked actionable suggestions for a scan result.
 * Returns top N actions sorted by priority, highest first.
 *
 * Oracle should pick 1-2 and mention them naturally:
 *   "That card looks fantastic — no PSA grade though. Want me to
 *    find a grading service near you?"
 *
 * @param ctx - Scan context with result, vault state, category
 * @param maxActions - Maximum actions to return (default 4)
 */
export function generateScanActions(ctx: ScanActionContext, maxActions = 4): ScanAction[] {
  const actions: ScanAction[] = [];

  // ── Vault actions ───────────────────────────────────────
  actions.push(...getVaultActions(ctx));

  // ── Grading actions ─────────────────────────────────────
  actions.push(...getGradingActions(ctx));

  // ── Listing actions ─────────────────────────────────────
  actions.push(...getListingActions(ctx));

  // ── Research actions ────────────────────────────────────
  actions.push(...getResearchActions(ctx));

  // ── Protection actions ──────────────────────────────────
  actions.push(...getProtectionActions(ctx));

  // Sort by priority descending, return top N
  return actions
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxActions);
}

/**
 * Build the prompt block that Oracle sees for actionable suggestions.
 * Called from buildScanContext for recent scans.
 */
export function buildScanActionsBlock(
  scan: any,
  vaultItems: any[],
): string {
  const result = scan.analysis_result || {};
  const category = result.category || scan.category || 'general';
  const estimatedValue = parseFloat(
    String(result.estimatedValue || scan.estimated_value || '0').replace(/[^0-9.]/g, '')
  ) || 0;
  const decision = result.decision || scan.decision || 'N/A';
  const confidence = typeof result.confidence === 'number'
    ? (result.confidence <= 1 ? result.confidence * 100 : result.confidence)
    : 50;

  // Check vault status
  const itemName = (scan.item_name || result.itemName || '').toLowerCase();
  const inVault = vaultItems.some(
    (v: any) => (v.item_name || '').toLowerCase() === itemName
  );
  const isListed = false; // TODO: check marketplace listings when available

  const ctx: ScanActionContext = {
    result,
    inVault,
    isListed,
    vaultItems,
    category,
    estimatedValue,
    decision,
    confidence,
  };

  const actions = generateScanActions(ctx, 3);

  if (actions.length === 0) return '';

  let block = 'SUGGESTED ACTIONS: ';
  block += actions.map(a => a.suggestion).join(' | ');
  block += '\n';

  return block;
}

// =============================================================================
// ACTION GENERATORS — Category-aware, state-aware
// =============================================================================

function getVaultActions(ctx: ScanActionContext): ScanAction[] {
  const actions: ScanAction[] = [];

  if (!ctx.inVault && ctx.decision === 'BUY') {
    actions.push({
      id: 'vault-store',
      label: 'Store to Vault',
      suggestion: 'Store to vault for tracking',
      priority: ctx.estimatedValue > 50 ? 85 : 65,
      type: 'vault',
    });
  }

  if (!ctx.inVault && ctx.decision === 'BUY' && ctx.estimatedValue > 100) {
    actions.push({
      id: 'vault-inventory',
      label: 'Add to Inventory PDF',
      suggestion: 'Add to inventory records',
      priority: 60,
      type: 'vault',
    });
  }

  // If item IS in vault, suggest tracking value changes
  if (ctx.inVault) {
    actions.push({
      id: 'vault-update',
      label: 'Update Vault Value',
      suggestion: 'Update vault with latest valuation',
      priority: 50,
      type: 'vault',
    });
  }

  return actions;
}

function getGradingActions(ctx: ScanActionContext): ScanAction[] {
  const actions: ScanAction[] = [];
  const cat = ctx.category.toLowerCase();

  // ── Trading cards — PSA, CGC, BGS ───────────────────────
  if (isCardCategory(cat)) {
    const hasGrade = hasExistingGrade(ctx.result);
    if (!hasGrade && ctx.estimatedValue > 20) {
      actions.push({
        id: 'grade-psa',
        label: 'PSA Grading',
        suggestion: 'No grade — PSA submission could increase value significantly',
        priority: ctx.estimatedValue > 100 ? 90 : 70,
        type: 'grade',
      });
    }
    if (!hasGrade && ctx.estimatedValue > 50) {
      actions.push({
        id: 'grade-cgc',
        label: 'CGC/BGS Grading',
        suggestion: 'Consider CGC or BGS grading as alternatives to PSA',
        priority: 55,
        type: 'grade',
      });
    }
  }

  // ── Coins — NGC, PCGS ──────────────────────────────────
  if (isCoinCategory(cat)) {
    const hasGrade = hasExistingGrade(ctx.result);
    if (!hasGrade && ctx.estimatedValue > 30) {
      actions.push({
        id: 'grade-ngc',
        label: 'NGC/PCGS Grading',
        suggestion: 'Ungraded coin — NGC or PCGS certification could increase value',
        priority: ctx.estimatedValue > 100 ? 88 : 68,
        type: 'grade',
      });
    }
  }

  // ── Comics — CGC ────────────────────────────────────────
  if (cat.includes('comic') || cat.includes('manga')) {
    const hasGrade = hasExistingGrade(ctx.result);
    if (!hasGrade && ctx.estimatedValue > 25) {
      actions.push({
        id: 'grade-cgc-comics',
        label: 'CGC Comics Grading',
        suggestion: 'CGC grading could significantly boost resale value',
        priority: ctx.estimatedValue > 75 ? 85 : 65,
        type: 'grade',
      });
    }
  }

  return actions;
}

function getListingActions(ctx: ScanActionContext): ScanAction[] {
  const actions: ScanAction[] = [];
  const cat = ctx.category.toLowerCase();

  if (ctx.decision !== 'BUY' && ctx.decision !== 'HOLD') return actions;
  if (ctx.isListed) return actions;

  // ── eBay — universal ────────────────────────────────────
  actions.push({
    id: 'list-ebay',
    label: 'List on eBay',
    suggestion: `List on eBay — strong market for ${ctx.category}`,
    priority: ctx.estimatedValue > 30 ? 70 : 45,
    type: 'list',
  });

  // ── Category-specific platforms ─────────────────────────
  if (isCardCategory(cat)) {
    actions.push({
      id: 'list-tcgplayer',
      label: 'List on TCGPlayer',
      suggestion: 'TCGPlayer for trading cards — dedicated collector audience',
      priority: 65,
      type: 'list',
    });
  }

  if (cat.includes('sneaker') || cat.includes('shoe') || cat.includes('streetwear')) {
    actions.push({
      id: 'list-stockx',
      label: 'List on StockX/GOAT',
      suggestion: 'StockX or GOAT for authenticated sneaker sales',
      priority: 75,
      type: 'list',
    });
  }

  if (cat.includes('clothing') || cat.includes('fashion') || cat.includes('apparel')) {
    actions.push({
      id: 'list-poshmark',
      label: 'List on Poshmark',
      suggestion: 'Poshmark has a strong fashion buyer community',
      priority: 60,
      type: 'list',
    });
  }

  if (isCoinCategory(cat) && ctx.estimatedValue > 200) {
    actions.push({
      id: 'list-heritage',
      label: 'Heritage Auctions',
      suggestion: 'Heritage Auctions for high-value coins — serious collector audience',
      priority: 75,
      type: 'list',
    });
  }

  if (cat.includes('vinyl') || cat.includes('record') || cat.includes('music')) {
    actions.push({
      id: 'list-discogs',
      label: 'List on Discogs',
      suggestion: 'Discogs marketplace for vinyl records',
      priority: 70,
      type: 'list',
    });
  }

  if (cat.includes('book') || cat.includes('literature')) {
    actions.push({
      id: 'list-abebooks',
      label: 'List on AbeBooks',
      suggestion: 'AbeBooks specializes in books — better audience than eBay for rare editions',
      priority: 65,
      type: 'list',
    });
  }

  if (cat.includes('lego') || cat.includes('brick')) {
    actions.push({
      id: 'list-bricklink',
      label: 'List on BrickLink',
      suggestion: 'BrickLink is the go-to marketplace for LEGO sets and parts',
      priority: 70,
      type: 'list',
    });
  }

  // ── High value — auction house consideration ────────────
  if (ctx.estimatedValue > 500) {
    actions.push({
      id: 'list-auction',
      label: 'Consider Auction House',
      suggestion: 'At this value, a professional auction house could maximize return',
      priority: 60,
      type: 'list',
    });
  }

  return actions;
}

function getResearchActions(ctx: ScanActionContext): ScanAction[] {
  const actions: ScanAction[] = [];
  const cat = ctx.category.toLowerCase();

  // ── Low confidence — more research needed ───────────────
  if (ctx.confidence < 60) {
    actions.push({
      id: 'research-deeper',
      label: 'Deeper Research',
      suggestion: 'Confidence is moderate — deeper research could clarify value',
      priority: 75,
      type: 'research',
    });
  }

  // ── Electronics/appliances — find user manual ───────────
  if (cat.includes('electronic') || cat.includes('appliance') || cat.includes('tech')
    || cat.includes('camera') || cat.includes('audio') || cat.includes('tool')) {
    actions.push({
      id: 'research-manual',
      label: 'Find User Manual',
      suggestion: 'User manual available online — useful for buyers and adds listing value',
      priority: 45,
      type: 'research',
    });
  }

  // ── Vehicles — Carfax, recall check ─────────────────────
  if (cat.includes('vehicle') || cat.includes('auto') || cat.includes('car')
    || cat.includes('motorcycle') || cat.includes('truck')) {
    actions.push({
      id: 'research-carfax',
      label: 'Pull Vehicle History',
      suggestion: 'Carfax or AutoCheck report would add buyer confidence',
      priority: 80,
      type: 'research',
    });
    actions.push({
      id: 'research-recalls',
      label: 'Check NHTSA Recalls',
      suggestion: 'NHTSA recall check — important for buyer disclosure',
      priority: 70,
      type: 'research',
    });
  }

  // ── History/provenance for high-value items ─────────────
  if (ctx.estimatedValue > 200) {
    actions.push({
      id: 'research-history',
      label: 'Item History',
      suggestion: 'Interesting piece — provenance or historical context could boost value',
      priority: 50,
      type: 'research',
    });
  }

  // ── Comparable sales analysis ───────────────────────────
  if (ctx.decision === 'BUY' && ctx.estimatedValue > 50) {
    actions.push({
      id: 'research-comps',
      label: 'Comparable Sales',
      suggestion: 'Check recent sold comps to time the listing optimally',
      priority: 55,
      type: 'research',
    });
  }

  return actions;
}

function getProtectionActions(ctx: ScanActionContext): ScanAction[] {
  const actions: ScanAction[] = [];

  // ── High value — insurance consideration ────────────────
  if (ctx.estimatedValue > 500 && ctx.inVault) {
    actions.push({
      id: 'protect-insure',
      label: 'Consider Insurance',
      suggestion: 'At $500+, collectible insurance worth considering',
      priority: 55,
      type: 'protect',
    });
  }

  // ── Authentication for luxury/high-value ────────────────
  if (ctx.estimatedValue > 200) {
    const cat = ctx.category.toLowerCase();
    if (cat.includes('watch') || cat.includes('luxury') || cat.includes('handbag')
      || cat.includes('designer') || cat.includes('jewelry')) {
      actions.push({
        id: 'protect-authenticate',
        label: 'Get Authenticated',
        suggestion: 'Professional authentication adds significant buyer confidence for luxury items',
        priority: 80,
        type: 'protect',
      });
    }
  }

  // ── Preservation tips ───────────────────────────────────
  if (ctx.inVault && ctx.estimatedValue > 100) {
    actions.push({
      id: 'protect-preserve',
      label: 'Preservation Tips',
      suggestion: 'Proper storage preserves value — ask about best practices for this category',
      priority: 35,
      type: 'protect',
    });
  }

  return actions;
}

// =============================================================================
// CATEGORY HELPERS
// =============================================================================

function isCardCategory(cat: string): boolean {
  return cat.includes('card') || cat.includes('pokemon') || cat.includes('tcg')
    || cat.includes('sports card') || cat.includes('trading') || cat.includes('baseball')
    || cat.includes('basketball') || cat.includes('football') || cat.includes('hockey')
    || cat.includes('yugioh') || cat.includes('magic');
}

function isCoinCategory(cat: string): boolean {
  return cat.includes('coin') || cat.includes('numismatic') || cat.includes('currency')
    || cat.includes('token') || cat.includes('medal') || cat.includes('bullion');
}

function hasExistingGrade(result: any): boolean {
  const auth = result?.authorityData || {};
  const details = auth.itemDetails || auth.details || {};

  // Check for any grade-related field
  return !!(
    details.grade
    || details.psa_grade
    || details.ngc_grade
    || details.pcgs_grade
    || details.cgc_grade
    || details.condition_grade
    || (result.summary_reasoning || '').match(/\b(PSA|NGC|PCGS|CGC|BGS)\s+\d/i)
  );
}