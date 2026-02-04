// FILE: src/lib/ghost-kpi-tracker.ts
// Ghost Protocol - Comprehensive KPI Tracking Service
// Captures ALL 50+ data points, surfaces top 5 to investors
// Silver and copper KPIs feed HYDRA training and internal analytics

import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// SHIPPING LOGIC - Fair for both parties
// =============================================================================

export type ShippingPayer = 'buyer' | 'seller' | 'split' | 'local_only';

export interface ShippingRecommendation {
  recommended_payer: ShippingPayer;
  estimated_cost: number;
  reason: string;
  seller_margin_if_absorbed: number;
  buyer_total_if_paid: number;
}

export interface ShippingConfig {
  payer: ShippingPayer;
  cost: number;
  carrier_preference?: string;
  offer_local_pickup: boolean;
  free_shipping_threshold?: number; // "Free shipping on orders over $X"
}

/**
 * Smart shipping recommendation based on item characteristics
 * Goal: Maximize conversion while protecting seller margin
 */
export function getShippingRecommendation(
  itemValue: number,
  shelfPrice: number,
  estimatedShippingCost: number,
  category: string,
  weight?: number,
  dimensions?: { l: number; w: number; h: number }
): ShippingRecommendation {
  
  const margin = itemValue - shelfPrice;
  const marginAfterShipping = margin - estimatedShippingCost;
  const shippingAsPercentOfValue = (estimatedShippingCost / itemValue) * 100;
  const marginPercentAfterShipping = (marginAfterShipping / shelfPrice) * 100;

  // Rule 1: Local pickup only for large/heavy items
  if (weight && weight > 50) {
    return {
      recommended_payer: 'local_only',
      estimated_cost: 0,
      reason: 'Item over 50lbs - local pickup recommended',
      seller_margin_if_absorbed: margin,
      buyer_total_if_paid: itemValue,
    };
  }

  // Rule 2: Furniture/Vehicles - local pickup
  const localOnlyCategories = ['furniture', 'vehicles', 'appliances', 'equipment'];
  if (localOnlyCategories.some(c => category.toLowerCase().includes(c))) {
    return {
      recommended_payer: 'local_only',
      estimated_cost: 0,
      reason: `${category} items typically require local pickup`,
      seller_margin_if_absorbed: margin,
      buyer_total_if_paid: itemValue,
    };
  }

  // Rule 3: If shipping < 5% of item value AND margin stays > 50%, seller pays (faster sale)
  if (shippingAsPercentOfValue < 5 && marginPercentAfterShipping > 50) {
    return {
      recommended_payer: 'seller',
      estimated_cost: estimatedShippingCost,
      reason: 'Low shipping cost relative to value - absorb for faster sales',
      seller_margin_if_absorbed: marginAfterShipping,
      buyer_total_if_paid: itemValue + estimatedShippingCost,
    };
  }

  // Rule 4: If shipping would eat >30% of margin, buyer pays
  if (estimatedShippingCost > margin * 0.3) {
    return {
      recommended_payer: 'buyer',
      estimated_cost: estimatedShippingCost,
      reason: 'Shipping cost significant - buyer pays to protect your margin',
      seller_margin_if_absorbed: marginAfterShipping,
      buyer_total_if_paid: itemValue + estimatedShippingCost,
    };
  }

  // Rule 5: High-value items (>$100) with reasonable shipping - seller pays for conversion
  if (itemValue > 100 && shippingAsPercentOfValue < 10) {
    return {
      recommended_payer: 'seller',
      estimated_cost: estimatedShippingCost,
      reason: '"Free shipping" converts 30% better on items over $100',
      seller_margin_if_absorbed: marginAfterShipping,
      buyer_total_if_paid: itemValue + estimatedShippingCost,
    };
  }

  // Default: Buyer pays, but show them the total upfront
  return {
    recommended_payer: 'buyer',
    estimated_cost: estimatedShippingCost,
    reason: 'Standard: buyer pays shipping, shown at checkout',
    seller_margin_if_absorbed: marginAfterShipping,
    buyer_total_if_paid: itemValue + estimatedShippingCost,
  };
}

// =============================================================================
// COMPREHENSIVE KPI TRACKING - All 50+ data points
// =============================================================================

/**
 * TIER 1: SCOUT BEHAVIOR KPIs (Gold - feeds Scout Economics)
 */
export interface ScoutBehaviorKPIs {
  // Scan Phase
  app_open_to_scan_ms: number | null;
  scan_attempts_before_success: number;
  camera_switch_count: number;
  ghost_toggle_hesitation_ms: number | null;
  photos_per_item: number;
  barcode_vs_photo: 'barcode' | 'photo' | 'both';
  
  // Decision Phase
  hydra_wait_time_ms: number | null;
  price_adjustment_count: number;
  price_adjustment_direction: 'higher' | 'lower' | 'none';
  price_adjustment_amount: number;
  description_edit_percent: number; // % of AI text kept
  ghost_mode_completed: boolean;
  
  // Listing Phase
  platforms_exported: string[];
  time_to_first_export_ms: number | null;
  handling_time_selected: number;
  shipping_payer_choice: ShippingPayer;
  
  // Fulfillment Phase
  notification_to_retrieval_hours: number | null;
  item_still_available: boolean;
  actual_vs_recorded_price_diff: number;
  fulfillment_completed: boolean;
  distance_traveled_km: number | null;
}

/**
 * TIER 2: STORE INTELLIGENCE KPIs (Silver - feeds Coverage Velocity)
 */
export interface StoreIntelligenceKPIs {
  // Store Profile
  store_id: string; // Generated hash of name + GPS
  store_type: string;
  store_gps_lat: number;
  store_gps_lng: number;
  store_gps_accuracy: number;
  store_name: string;
  store_aisle: string | null;
  store_hours: string | null;
  
  // Store Analytics
  store_visit_count: number; // How many times this scout visited
  store_avg_margin: number | null;
  store_best_category: string | null;
  store_pricing_tier: 'budget' | 'mid' | 'premium' | null;
  
  // Regional
  region_code: string; // State/Province
  zip_code: string | null;
  metro_area: string | null;
}

/**
 * TIER 3: ITEM INTELLIGENCE KPIs (Silver - feeds Dark Inventory Index)
 */
export interface ItemIntelligenceKPIs {
  // Identification
  item_id: string;
  category_tree: string[]; // ['Collectibles', 'Coins', 'US Coins', 'Silver Dollars']
  hydra_classification_confidence: number;
  barcode: string | null;
  
  // Pricing
  shelf_price: number;
  listed_price: number;
  sold_price: number | null;
  hydra_estimated_value: number;
  
  // Condition & Quality
  condition_grade: string | null;
  photo_quality_score: number | null; // 0-100
  image_count: number;
  has_documents: boolean;
  
  // Rarity & Demand
  similar_items_on_market: number | null;
  estimated_demand_score: 'low' | 'medium' | 'high' | null;
  days_on_market: number | null;
}

/**
 * TIER 4: AI FEEDBACK KPIs (Copper - feeds HYDRA Accuracy)
 */
export interface AIFeedbackKPIs {
  // Prediction Tracking
  hydra_estimate: number;
  actual_sold_price: number | null;
  prediction_error_dollars: number | null;
  prediction_error_percent: number | null;
  prediction_direction: 'over' | 'under' | 'accurate' | null;
  
  // Confidence Calibration
  hydra_confidence: number;
  outcome_matched_confidence: boolean | null;
  
  // Model Performance
  primary_model_used: string; // 'gemini', 'gpt4v', 'ensemble'
  models_consulted: string[];
  consensus_score: number | null;
  
  // User Corrections
  user_corrected_category: boolean;
  user_corrected_price: boolean;
  correction_magnitude: number | null;
}

/**
 * TIER 5: MARKET SIGNALS KPIs (Copper - feeds Arbitrage Spread)
 */
export interface MarketSignalKPIs {
  // Transaction Data
  sale_platform: string | null;
  platform_fees_paid: number | null;
  shipping_cost_actual: number | null;
  net_profit: number | null;
  roi_percent: number | null;
  
  // Timing
  list_to_sale_hours: number | null;
  sale_to_ship_hours: number | null;
  total_cycle_hours: number | null;
  
  // Market Conditions
  day_of_week_listed: number;
  day_of_week_sold: number | null;
  time_of_day_listed: number; // Hour 0-23
  season: 'spring' | 'summer' | 'fall' | 'winter';
}

/**
 * MASTER KPI OBJECT - All 50+ data points in one structure
 */
export interface GhostKPIBundle {
  // Metadata
  id: string;
  user_id: string;
  listing_id: string | null;
  created_at: string;
  updated_at: string;
  
  // All tiers
  scout: Partial<ScoutBehaviorKPIs>;
  store: Partial<StoreIntelligenceKPIs>;
  item: Partial<ItemIntelligenceKPIs>;
  ai: Partial<AIFeedbackKPIs>;
  market: Partial<MarketSignalKPIs>;
  
  // Status
  phase: 'scanning' | 'analyzing' | 'listing' | 'active' | 'sold' | 'fulfilling' | 'fulfilled' | 'expired' | 'cancelled';
}

// =============================================================================
// KPI TRACKER CLASS
// =============================================================================

export class GhostKPITracker {
  private bundle: GhostKPIBundle;
  private startTime: number;
  private phaseTimestamps: Record<string, number> = {};

  constructor(userId: string) {
    this.startTime = Date.now();
    this.bundle = {
      id: uuidv4(),
      user_id: userId,
      listing_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      scout: {},
      store: {},
      item: {},
      ai: {},
      market: {},
      phase: 'scanning',
    };
  }

  // =========================================================================
  // PHASE TRANSITIONS
  // =========================================================================

  startScanning() {
    this.phaseTimestamps.scan_start = Date.now();
    this.bundle.phase = 'scanning';
  }

  startAnalyzing() {
    this.phaseTimestamps.analyze_start = Date.now();
    this.bundle.phase = 'analyzing';
    
    // Calculate scan phase duration
    if (this.phaseTimestamps.scan_start) {
      this.bundle.scout.app_open_to_scan_ms = 
        this.phaseTimestamps.analyze_start - this.phaseTimestamps.scan_start;
    }
  }

  startListing() {
    this.phaseTimestamps.list_start = Date.now();
    this.bundle.phase = 'listing';
    
    // Calculate HYDRA wait time
    if (this.phaseTimestamps.analyze_start) {
      this.bundle.scout.hydra_wait_time_ms = 
        this.phaseTimestamps.list_start - this.phaseTimestamps.analyze_start;
    }
  }

  activateListing(listingId: string) {
    this.phaseTimestamps.active_start = Date.now();
    this.bundle.phase = 'active';
    this.bundle.listing_id = listingId;
    
    // Calculate time to first export
    if (this.phaseTimestamps.list_start) {
      this.bundle.scout.time_to_first_export_ms = 
        this.phaseTimestamps.active_start - this.phaseTimestamps.list_start;
    }
  }

  markSold() {
    this.phaseTimestamps.sold_at = Date.now();
    this.bundle.phase = 'sold';
    
    // Calculate list to sale duration
    if (this.phaseTimestamps.active_start) {
      const hours = (this.phaseTimestamps.sold_at - this.phaseTimestamps.active_start) / (1000 * 60 * 60);
      this.bundle.market.list_to_sale_hours = Math.round(hours * 10) / 10;
    }
  }

  startFulfilling() {
    this.phaseTimestamps.fulfill_start = Date.now();
    this.bundle.phase = 'fulfilling';
    
    // Calculate notification to action time
    if (this.phaseTimestamps.sold_at) {
      const hours = (this.phaseTimestamps.fulfill_start - this.phaseTimestamps.sold_at) / (1000 * 60 * 60);
      this.bundle.scout.notification_to_retrieval_hours = Math.round(hours * 10) / 10;
    }
  }

  completeFulfillment() {
    this.phaseTimestamps.fulfilled_at = Date.now();
    this.bundle.phase = 'fulfilled';
    this.bundle.scout.fulfillment_completed = true;
    
    // Calculate total cycle time
    if (this.phaseTimestamps.active_start) {
      const hours = (this.phaseTimestamps.fulfilled_at - this.phaseTimestamps.active_start) / (1000 * 60 * 60);
      this.bundle.market.total_cycle_hours = Math.round(hours * 10) / 10;
    }
  }

  // =========================================================================
  // SCOUT BEHAVIOR TRACKING
  // =========================================================================

  trackCameraSwitch() {
    this.bundle.scout.camera_switch_count = (this.bundle.scout.camera_switch_count || 0) + 1;
  }

  trackScanAttempt() {
    this.bundle.scout.scan_attempts_before_success = 
      (this.bundle.scout.scan_attempts_before_success || 0) + 1;
  }

  trackGhostToggle(enabled: boolean) {
    if (enabled && !this.phaseTimestamps.ghost_toggle) {
      this.phaseTimestamps.ghost_toggle = Date.now();
      if (this.phaseTimestamps.scan_start) {
        this.bundle.scout.ghost_toggle_hesitation_ms = 
          this.phaseTimestamps.ghost_toggle - this.phaseTimestamps.scan_start;
      }
    }
    this.bundle.scout.ghost_mode_completed = enabled;
  }

  trackPhotoCapture() {
    this.bundle.scout.photos_per_item = (this.bundle.scout.photos_per_item || 0) + 1;
    this.bundle.scout.barcode_vs_photo = 
      this.bundle.scout.barcode_vs_photo === 'barcode' ? 'both' : 'photo';
  }

  trackBarcodeCapture() {
    this.bundle.scout.barcode_vs_photo = 
      this.bundle.scout.barcode_vs_photo === 'photo' ? 'both' : 'barcode';
  }

  trackPriceAdjustment(originalPrice: number, newPrice: number) {
    this.bundle.scout.price_adjustment_count = 
      (this.bundle.scout.price_adjustment_count || 0) + 1;
    
    const diff = newPrice - originalPrice;
    this.bundle.scout.price_adjustment_amount = diff;
    this.bundle.scout.price_adjustment_direction = 
      diff > 0 ? 'higher' : diff < 0 ? 'lower' : 'none';
  }

  trackDescriptionEdit(originalLength: number, finalLength: number, keptChars: number) {
    this.bundle.scout.description_edit_percent = 
      originalLength > 0 ? Math.round((keptChars / originalLength) * 100) : 100;
  }

  trackPlatformExport(platform: string) {
    if (!this.bundle.scout.platforms_exported) {
      this.bundle.scout.platforms_exported = [];
    }
    if (!this.bundle.scout.platforms_exported.includes(platform)) {
      this.bundle.scout.platforms_exported.push(platform);
    }
  }

  trackHandlingTime(hours: number) {
    this.bundle.scout.handling_time_selected = hours;
  }

  trackShippingChoice(payer: ShippingPayer) {
    this.bundle.scout.shipping_payer_choice = payer;
  }

  // =========================================================================
  // STORE INTELLIGENCE TRACKING
  // =========================================================================

  setStoreInfo(info: {
    name: string;
    type: string;
    lat: number;
    lng: number;
    accuracy: number;
    aisle?: string;
    hours?: string;
    zipCode?: string;
  }) {
    // Generate consistent store ID from name + location
    const storeIdSource = `${info.name.toLowerCase().trim()}_${info.lat.toFixed(3)}_${info.lng.toFixed(3)}`;
    this.bundle.store.store_id = this.hashString(storeIdSource);
    
    this.bundle.store.store_name = info.name;
    this.bundle.store.store_type = info.type;
    this.bundle.store.store_gps_lat = info.lat;
    this.bundle.store.store_gps_lng = info.lng;
    this.bundle.store.store_gps_accuracy = info.accuracy;
    this.bundle.store.store_aisle = info.aisle || null;
    this.bundle.store.store_hours = info.hours || null;
    this.bundle.store.zip_code = info.zipCode || null;
    
    // Derive region from coordinates (simplified - would use reverse geocoding)
    this.bundle.store.region_code = this.getRegionFromCoords(info.lat, info.lng);
  }

  incrementStoreVisit() {
    this.bundle.store.store_visit_count = (this.bundle.store.store_visit_count || 0) + 1;
  }

  // =========================================================================
  // ITEM INTELLIGENCE TRACKING
  // =========================================================================

  setItemInfo(info: {
    category: string[];
    shelfPrice: number;
    listedPrice: number;
    hydraEstimate: number;
    confidence: number;
    barcode?: string;
    condition?: string;
    imageCount: number;
    hasDocuments: boolean;
  }) {
    this.bundle.item.item_id = uuidv4();
    this.bundle.item.category_tree = info.category;
    this.bundle.item.shelf_price = info.shelfPrice;
    this.bundle.item.listed_price = info.listedPrice;
    this.bundle.item.hydra_estimated_value = info.hydraEstimate;
    this.bundle.item.hydra_classification_confidence = info.confidence;
    this.bundle.item.barcode = info.barcode || null;
    this.bundle.item.condition_grade = info.condition || null;
    this.bundle.item.image_count = info.imageCount;
    this.bundle.item.has_documents = info.hasDocuments;
  }

  setPhotoQuality(score: number) {
    this.bundle.item.photo_quality_score = score;
  }

  setSoldPrice(price: number) {
    this.bundle.item.sold_price = price;
  }

  // =========================================================================
  // AI FEEDBACK TRACKING
  // =========================================================================

  setHydraResults(results: {
    estimate: number;
    confidence: number;
    primaryModel: string;
    modelsUsed: string[];
    consensusScore?: number;
  }) {
    this.bundle.ai.hydra_estimate = results.estimate;
    this.bundle.ai.hydra_confidence = results.confidence;
    this.bundle.ai.primary_model_used = results.primaryModel;
    this.bundle.ai.models_consulted = results.modelsUsed;
    this.bundle.ai.consensus_score = results.consensusScore || null;
  }

  recordPredictionOutcome(actualPrice: number) {
    const estimate = this.bundle.ai.hydra_estimate || 0;
    const error = actualPrice - estimate;
    const errorPercent = estimate > 0 ? (error / estimate) * 100 : 0;
    
    this.bundle.ai.actual_sold_price = actualPrice;
    this.bundle.ai.prediction_error_dollars = error;
    this.bundle.ai.prediction_error_percent = Math.round(errorPercent * 10) / 10;
    this.bundle.ai.prediction_direction = 
      Math.abs(errorPercent) <= 12 ? 'accurate' : 
      error > 0 ? 'under' : 'over';
    
    // Check if confidence matched outcome
    const confidence = this.bundle.ai.hydra_confidence || 0;
    const accuracyThreshold = confidence > 80 ? 15 : confidence > 60 ? 25 : 40;
    this.bundle.ai.outcome_matched_confidence = Math.abs(errorPercent) <= accuracyThreshold;
  }

  trackUserCorrection(type: 'category' | 'price', magnitude?: number) {
    if (type === 'category') {
      this.bundle.ai.user_corrected_category = true;
    } else {
      this.bundle.ai.user_corrected_price = true;
      this.bundle.ai.correction_magnitude = magnitude || null;
    }
  }

  // =========================================================================
  // MARKET SIGNAL TRACKING
  // =========================================================================

  recordSale(info: {
    platform: string;
    platformFees: number;
    shippingCost: number;
    netProfit: number;
  }) {
    this.bundle.market.sale_platform = info.platform;
    this.bundle.market.platform_fees_paid = info.platformFees;
    this.bundle.market.shipping_cost_actual = info.shippingCost;
    this.bundle.market.net_profit = info.netProfit;
    
    // Calculate ROI
    const cost = this.bundle.item.shelf_price || 0;
    if (cost > 0) {
      this.bundle.market.roi_percent = Math.round((info.netProfit / cost) * 100);
    }
    
    // Record timing
    this.bundle.market.day_of_week_sold = new Date().getDay();
  }

  // Called when listing is created
  recordListingTiming() {
    const now = new Date();
    this.bundle.market.day_of_week_listed = now.getDay();
    this.bundle.market.time_of_day_listed = now.getHours();
    
    const month = now.getMonth();
    this.bundle.market.season = 
      month >= 2 && month <= 4 ? 'spring' :
      month >= 5 && month <= 7 ? 'summer' :
      month >= 8 && month <= 10 ? 'fall' : 'winter';
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private getRegionFromCoords(lat: number, lng: number): string {
    // Simplified US region detection - would use proper reverse geocoding
    if (lng < -115) return 'WEST';
    if (lng < -100) return 'MOUNTAIN';
    if (lng < -85) return 'CENTRAL';
    if (lng < -75) return 'EAST';
    return 'OTHER';
  }

  // =========================================================================
  // EXPORT
  // =========================================================================

  getBundle(): GhostKPIBundle {
    this.bundle.updated_at = new Date().toISOString();
    return { ...this.bundle };
  }

  toJSON(): string {
    return JSON.stringify(this.getBundle(), null, 2);
  }

  // Get just the gold KPIs for quick display
  getGoldKPIs() {
    return {
      // Scout Economics
      time_to_complete_ms: this.phaseTimestamps.fulfilled_at 
        ? this.phaseTimestamps.fulfilled_at - this.startTime 
        : null,
      net_profit: this.bundle.market.net_profit,
      roi_percent: this.bundle.market.roi_percent,
      
      // HYDRA Accuracy
      hydra_accuracy_percent: this.bundle.ai.prediction_error_percent 
        ? 100 - Math.abs(this.bundle.ai.prediction_error_percent)
        : null,
      
      // Arbitrage
      markup_percent: this.bundle.item.shelf_price && this.bundle.item.sold_price
        ? ((this.bundle.item.sold_price - this.bundle.item.shelf_price) / this.bundle.item.shelf_price) * 100
        : null,
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE FOR CURRENT SESSION
// =============================================================================

let currentTracker: GhostKPITracker | null = null;

export function initKPITracker(userId: string): GhostKPITracker {
  currentTracker = new GhostKPITracker(userId);
  return currentTracker;
}

export function getKPITracker(): GhostKPITracker | null {
  return currentTracker;
}

export function resetKPITracker(): void {
  currentTracker = null;
}

export default GhostKPITracker;