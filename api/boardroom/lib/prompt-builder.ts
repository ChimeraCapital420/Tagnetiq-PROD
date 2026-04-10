// FILE: api/boardroom/lib/prompt-builder.ts
// Flat barrel — bridges './prompt-builder.js' imports to the ./prompt-builder/ folder.
export { buildBoardMemberPrompt } from './prompt-builder/builder.js';
export { buildTaskPrompt } from './prompt-builder/tasks.js';
export { buildBriefingPrompt } from './prompt-builder/briefing.js';
export type { BoardMember, PromptContext } from './prompt-builder/types.js';
export type { MediaAttachment } from './prompt-builder/media-context.js';
export { BILLIONAIRE_CORE, MEETING_MODIFIERS, ENERGY_ADAPTATIONS, ARC_GUIDANCE } from './prompt-builder/constants.js';
export { getMemberProtocolPrompt, getUniversalProtocolPrompt, getActiveProtocolGuidance } from './prompt-builder/elevation.js';
export { formatPersonalityEvolution, formatFounderMemory, formatEnergyGuidance, formatCrossBoardFeed, formatRecentDecisions, formatMeetingSummaries, formatCompanyContext, formatLegacyMemories, formatConversationHistory } from './prompt-builder/formatters.js';
export { formatMediaAttachment, formatMediaAttachments } from './prompt-builder/media-context.js';