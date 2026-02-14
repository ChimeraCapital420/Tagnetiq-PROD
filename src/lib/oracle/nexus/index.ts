// FILE: src/lib/oracle/nexus/index.ts
// Nexus Decision Module — barrel exports
//
// Sprint M: Oracle-guided post-scan decision flow

export {
  type NudgeType,
  type MarketDemand,
  type NexusDecision,
  type ListingDraft,
  type NexusAction,
  type ScanContext,
  type UserContext,
  evaluateScan,
  logNexusDecision,
} from './decision-tree.js';