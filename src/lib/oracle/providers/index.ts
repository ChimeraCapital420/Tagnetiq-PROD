// FILE: src/lib/oracle/providers/index.ts
// Oracle Provider Module — barrel exports
//
// Liberation 8: Added multi-call exports
// Liberation 7+9: Added RoutingResult type alias (= RoutingDecision)

export {
  type OracleProviderId,
  type ProviderStrength,
  type CostTier,
  type OracleProviderConfig,
  ORACLE_PROVIDERS,
  getProviderApiKey,
  isProviderAvailable,
  getAvailableProviders,
  getProvidersByStrength,
  getCheapestForStrength,
  getBestForStrength,
  resolveModelForTier,
  getBackgroundModel,
} from './registry.js';

export {
  type RoutingDecision,
  type RoutingDecision as RoutingResult,  // Alias used by chat.ts, multi-call.ts
  type MessageIntent,
  routeMessage,
} from './router.js';

export {
  type OracleMessage,
  type CallerResult,
  callOracle,
} from './caller.js';

export {
  type MultiPerspectiveResult,
  multiPerspectiveCall,
  isComplexEnoughForMulti,
} from './multi-call.js';