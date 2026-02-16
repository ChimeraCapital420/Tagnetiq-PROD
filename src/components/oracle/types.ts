// FILE: src/components/oracle/types.ts
// Oracle type definitions — chat, vision, hunt, content creation, rich responses
// Mobile-first: typed for structured JSON responses rendered client-side

// =============================================================================
// CHAT MESSAGES
// =============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** Rich attachments rendered below the text bubble */
  attachments?: RichAttachment[];
  /** Vision data from /api/oracle/see */
  visionData?: VisionResponse;
  /** Hunt triage result from /api/oracle/hunt */
  huntData?: HuntResult;
  /** Content creation result from /api/oracle/create */
  contentData?: ContentResult;
  /** Image thumbnail (base64 or object URL) for user-sent images */
  imagePreview?: string;
  /** Vision mode used for this message */
  visionMode?: VisionMode;
}

// =============================================================================
// QUICK CHIPS
// =============================================================================

export interface QuickChip {
  label: string;
  message: string;
  icon?: string;
}

// =============================================================================
// CONVERSATIONS
// =============================================================================

export interface ConversationSummary {
  id: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// VISION (api/oracle/see)
// =============================================================================

export type VisionMode =
  | 'glance'       // Quick look — what is this?
  | 'identify'     // Deep identification + value estimate
  | 'room_scan'    // Scan a whole room for items
  | 'hunt_scan'    // Scan a shelf/table at flea market
  | 'read'         // OCR — read text from image
  | 'remember';    // Store visual memory for later recall

export interface VisionObject {
  name: string;
  category?: string;
  confidence: number;
  estimatedValue?: { low: number; high: number; currency: string };
  condition?: string;
  notes?: string;
}

export interface VisionResponse {
  mode: VisionMode;
  description: string;
  objects: VisionObject[];
  extractedText?: string;
  memoryId?: string;
  auctionCopilot?: AuctionCopilot;
  processingTimeMs: number;
}

export interface AuctionCopilot {
  currentBid: number;
  maxBudget: number;
  verdict: 'BID' | 'HOLD' | 'WALK';
  reasoning: string;
  suggestedMax: number;
}

// =============================================================================
// HUNT TRIAGE (api/oracle/hunt)
// =============================================================================

export interface HuntResult {
  verdict: 'BUY' | 'SKIP' | 'HOLD' | 'RESEARCH';
  confidence: number;
  itemName: string;
  estimatedValue: { low: number; high: number; currency: string };
  askingPrice?: number;
  margin?: { amount: number; percentage: number };
  reasoning: string;
  category?: string;
  quickFacts?: string[];
  processingTimeMs: number;
}

// =============================================================================
// CONTENT CREATION (api/oracle/create)
// =============================================================================

export type ContentMode =
  | 'listing'       // Marketplace listing in user's voice
  | 'image'         // AI-generated product/marketing image
  | 'video'         // Video via InVideo
  | 'brag_card'     // Social media flex card
  | 'description';  // Platform-optimized item description

export interface ContentResult {
  mode: ContentMode;
  /** Listing-specific fields */
  listing?: GeneratedListing;
  /** Image generation result */
  imageUrl?: string;
  /** Video generation result */
  videoUrl?: string;
  videoStatus?: 'generating' | 'ready' | 'failed';
  /** Raw text output for descriptions */
  text?: string;
  /** Can the user edit and regenerate? */
  editable: boolean;
}

export interface GeneratedListing {
  title: string;
  description: string;
  suggestedPrice: number;
  platform: string;
  tags: string[];
  condition?: string;
  shippingNotes?: string;
  /** Was this generated in the user's voice profile? */
  voiceMatched: boolean;
}

// =============================================================================
// RICH ATTACHMENTS (rendered in chat bubbles)
// =============================================================================

export type RichAttachment =
  | { type: 'vision'; data: VisionResponse }
  | { type: 'hunt'; data: HuntResult }
  | { type: 'listing'; data: GeneratedListing }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'video'; url: string; status: string }
  | { type: 'learning'; step: LearningStep }
  | { type: 'introduction'; data: IntroductionCard };

// =============================================================================
// LEARNING (api/oracle/learn)
// =============================================================================

export interface LearningStep {
  stepNumber: number;
  totalSteps: number;
  title: string;
  content: string;
  challenge?: string;
  hint?: string;
  completed: boolean;
}

export interface LearningPath {
  id: string;
  topic: string;
  steps: LearningStep[];
  currentStep: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  startedAt: string;
}

// =============================================================================
// INTRODUCTIONS (api/oracle/introductions)
// =============================================================================

export interface IntroductionCard {
  matchId: string;
  sharedInterests: string[];
  matchDescription: string; // Oracle's description of why they match
  status: 'pending' | 'accepted' | 'declined';
}

// =============================================================================
// ENERGY / PERSONALITY
// =============================================================================

export type EnergyLevel = 'excited' | 'frustrated' | 'focused' | 'curious' | 'casual' | 'neutral';

export type EnergyArc =
  | 'building_excitement'
  | 'losing_interest'
  | 'problem_solving'
  | 'exploring'
  | 'venting'
  | 'celebrating'
  | 'learning'
  | 'steady';

export type ExpertiseLevel = 'newcomer' | 'learning' | 'intermediate' | 'advanced' | 'expert';

// =============================================================================
// TRUST
// =============================================================================

export interface TrustMetrics {
  adviceFollowed: number;
  adviceIgnored: number;
  accurateEstimates: number;
  inaccurateEstimates: number;
  trustScore: number; // 0-100
  lastUpdated: string;
}

// =============================================================================
// ORACLE INPUT MODES
// =============================================================================

export type InputMode = 'text' | 'camera' | 'voice';

export interface CameraCapture {
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  /** Compressed size in bytes (done client-side) */
  sizeBytes: number;
}
