# 🚀 SPRINT N — DEPLOY MANIFEST
## Single Deploy — All Files

**Run Supabase migration FIRST, then deploy all files.**

---

## PRE-DEPLOY: Supabase Migration
```bash
# Run in Supabase SQL Editor or via CLI
supabase/sprint-n-migration.sql
```
Creates: `oracle_memory_summaries`, `oracle_learning_progress`, `oracle_introductions`
Alters: `oracle_identity` (adds `trust_metrics`, `voice_profile` columns)

---

## NEW FILES (13 files — zero risk, pure additions)

| # | File | Purpose |
|---|------|---------|
| 1 | `src/lib/oracle/memory/compressor.ts` | Compress conversations → structured summaries |
| 2 | `src/lib/oracle/memory/index.ts` | Memory retrieval, expertise derivation, interest aggregation |
| 3 | `src/lib/oracle/trust/tracker.ts` | Trust score tracking, signal detection |
| 4 | `src/lib/oracle/voice-profile/index.ts` | User writing style analysis for listings |
| 5 | `src/lib/oracle/community/matchmaker.ts` | User matching for Oracle introductions |
| 6 | `src/lib/oracle/prompt/memory-context.ts` | Memory → system prompt block |
| 7 | `src/lib/oracle/prompt/trust-context.ts` | Trust → system prompt block |
| 8 | `src/lib/oracle/prompt/creator-context.ts` | Content creation prompts (listings, video, brag) |
| 9 | `src/lib/oracle/prompt/learning-context.ts` | Learning mode prompts |
| 10 | `src/lib/oracle/prompt/seasonal-context.ts` | Calendar-aware market intelligence |
| 11 | `api/oracle/create.ts` | Content creation endpoint (listings, video, image) |
| 12 | `api/oracle/learn.ts` | Structured learning paths endpoint |
| 13 | `api/oracle/introductions.ts` | Double opt-in user matching endpoint |

## MODIFIED FILES (10 files — full copy-paste replacements)

| # | File | What Changed |
|---|------|-------------|
| 14 | `src/components/oracle/types.ts` | Added vision, hunt, content, learning, energy, trust types |
| 15 | `src/components/oracle/hooks/useOracleChat.ts` | Added sendImage, sendHunt, createContent, currentEnergy, offline queue |
| 16 | `src/components/oracle/components/OracleInputBar.tsx` | Added camera button, image capture, vision mode selector, image preview |
| 17 | `src/components/oracle/components/OracleChatMessages.tsx` | Added rich cards: vision, hunt verdict, listing preview, learning step |
| 18 | `src/components/oracle/OraclePage.tsx` | Wired camera/vision/hunt handlers, energy pass-through to TTS |
| 19 | `src/lib/oracle/prompt/builder.ts` | Added memory, trust, seasonal, energy arc context blocks. Backward compatible. |
| 20 | `src/lib/oracle/personality/energy.ts` | Full rewrite: multi-signal detection, conversation arcs, expertise detection |
| 21 | `src/hooks/useTts.ts` | Energy-aware voice: adjusts pitch/rate/stability per emotional state |
| 22 | `api/oracle/chat.ts` | Added memory fetch, trust signals, energy arc, compression triggers |
| 23 | `api/oracle/proactive.ts` | Fixed auth (verifyUser + supabaseAdmin), added seasonal awareness |

## BUG FIX (1 file — full replacement)

| # | File | What Was Broken |
|---|------|----------------|
| 24 | `api/user/preferences.ts` | Was using Next.js (NextRequest/getServerSession), duplicate imports. Rewritten to Vercel serverless. |

## PWA FILES (2 files — full replacements)

| # | File | What Changed |
|---|------|-------------|
| 25 | `public/sw.js` | Added Oracle push routing, offline scan queue, conversation caching, IndexedDB stores |
| 26 | `public/manifest.json` | Added Oracle shortcut |

---

## TOTAL: 26 files, 1 SQL migration, 1 deploy

## CAPABILITIES UNLOCKED:
- ✅ Camera/Vision in Oracle (6 modes)
- ✅ Hunt triage (instant BUY/SKIP)
- ✅ Long-term memory (cross-conversation recall)
- ✅ Trust self-calibration
- ✅ Energy-aware voice
- ✅ Expertise-adaptive language
- ✅ Seasonal market intelligence
- ✅ Conversation arc tracking
- ✅ Content creation (listings in user's voice)
- ✅ Video script generation
- ✅ Brag cards
- ✅ Structured learning paths
- ✅ Oracle-mediated introductions
- ✅ Offline message queue
- ✅ Oracle push notifications
- ✅ Fixed preferences API
- ✅ Fixed proactive auth

## POST-DEPLOY VERIFICATION:
1. Open Oracle → camera button should appear
2. Send a text message → check response has `energy` field
3. Send 2-3 messages → energy arc should appear in response
4. Take a photo → vision mode selector should show
5. Check Supabase → `oracle_memory_summaries` table should exist
6. GET /api/user/preferences → should return 200 (was broken before)
