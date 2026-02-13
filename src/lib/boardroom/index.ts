// FILE: src/lib/boardroom/index.ts
// Boardroom Module — barrel exports
//
// Sprint M: AI DNA + evolution
// Sprint P: Autonomous actions

export {
  type BoardMember,
  type InteractionResult,
  evolveBoarDna,
  evolveBoardAfterMeeting,
  buildBoardMemberPrompt,
  isCrossDomain,
} from './evolution.js';

export {
  type ActionStatus,
  type ImpactLevel,
  type ActionType,
  type ProposeActionParams,
  type ActionResult,
  type ActionExecution,
  proposeAction,
  approveAction,
  rejectAction,
  getPendingActions,
  getMemberActions,
  getActionStats,
} from './actions.js';