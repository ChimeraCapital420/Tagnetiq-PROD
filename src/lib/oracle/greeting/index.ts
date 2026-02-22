// FILE: src/lib/oracle/greeting/index.ts
// Oracle Greeting System — Public API
//
// USAGE:
//   import { analyzeUser, buildGreeting } from '@/lib/oracle/greeting';
//
//   const analysis = analyzeUser(profile);
//   const greeting = buildGreeting(screenName, analysis);
//
// Or use the React hook:
//   import { useOracleGreeting } from '@/hooks/useOracleGreeting';
//   const { greeting, analysis } = useOracleGreeting();

export {
  // Persona detection
  detectPersona,
  detectSessionIntent,
  detectEngagementLevel,
  getSuggestions,
  analyzeUser,
  // Types
  type UserPersona,
  type SessionIntent,
  type ServiceSuggestion,
  type PersonaAnalysis,
  type GreetingProfile,
} from './personas.js';

export {
  // Greeting builder
  buildGreeting,
  getTimeOfDay,
  // Types
  type TimeOfDay,
  type OracleGreeting,
} from './greetings.js';