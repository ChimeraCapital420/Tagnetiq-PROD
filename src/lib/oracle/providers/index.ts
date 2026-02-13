// FILE: src/lib/oracle/providers/index.ts
// Oracle Provider Module — barrel exports

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
} from './registry.js';

export {
  type RoutingDecision,
  type MessageIntent,
  routeMessage,
} from './router.js';

export {
  type OracleMessage,
  type CallerResult,
  callOracle,
} from './caller.js';