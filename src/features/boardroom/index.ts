// FILE: src/features/boardroom/index.ts
// Main barrel export for the boardroom feature
//
// Sprint 9: Added Intelligence module (client-side)

// Types
export * from './types';

// Constants
export * from './constants';

// Elevation Protocols - The 7 Frameworks that power all board members
export * from './elevation-protocols';

// Board Member Prompts - System prompts with elevation integration
export * from './board-member-prompts';

// Board Members Registry - All member configurations
export * from './members';

// Hooks
export * from './hooks';

// Components
export * from './components';

// Voice System
export * from './voice/types';
export { useVoiceConversation } from './voice/useVoiceConversation';

// Knowledge System
export * from './knowledge/living-knowledge-system';

// Sprint 9: Client-Side Intelligence (pure functions — safe for client)
export {
  // Energy detection
  detectClientEnergy,
  estimateRoomEnergy,
  type ClientEnergyType,
  type ClientEnergyResult,
  type ClientRoomEnergyHint,
  // Topic detection + routing preview
  detectClientTopic,
  previewRouting,
  type ClientRoutingPreview,
  // Context preloading
  preloadCognitiveContext,
  getCachedContext,
  clearCachedContext,
  type CachedCognitiveContext,
  // Offline queue
  isOnline,
  getPendingCount,
  getPendingMessages,
  type QueuedMessage,
  type OfflineQueueState,
} from './intelligence';