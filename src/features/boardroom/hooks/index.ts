// FILE: src/features/boardroom/hooks/index.ts
// Barrel export for boardroom hooks
//
// Sprint 7: Added useExecutionQueue, useStandups
// Sprint 9: Added useBoardroomIntelligence

export { useBoardroom } from './useBoardroom';
export { useBriefing } from './useBriefing';
export { useMeeting } from './useMeeting';
export type { UseMeetingWithIntelligence } from './useMeeting';
export { useTasks } from './useTasks';
export { useVoiceInput, type UseVoiceInputOptions, type UseVoiceInputReturn } from './useVoiceInput';
export { useExecutionQueue } from './useExecutionQueue';
export { useStandups } from './useStandups';

// Sprint 9: Client-Side Intelligence
export { useBoardroomIntelligence } from './useBoardroomIntelligence';
export type { BoardroomClientContext, UseBoardroomIntelligenceReturn } from './useBoardroomIntelligence';