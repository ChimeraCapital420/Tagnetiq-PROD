-- =============================================================================
-- PERSISTENT VOICE CHARACTER — Sprint N+
-- Adds catchphrases, running jokes, callback humor, signature expressions
-- to oracle_identity. These evolve over time like personality traits.
-- =============================================================================

-- New columns on oracle_identity
ALTER TABLE oracle_identity
ADD COLUMN IF NOT EXISTS voice_character JSONB DEFAULT '{}'::jsonb;

-- voice_character structure:
-- {
--   "catchphrases": ["Oh, NOW we're talking", "That's vault-worthy"],
--   "signature_greetings": ["What'd you find today?"],
--   "signature_reactions": {
--     "excitement": ["Oh NICE!", "Now THAT's a find"],
--     "disappointment": ["Eh, skip it", "Not worth the trunk space"],
--     "thinking": ["Hmm, let me look at this differently...", "Okay so here's the thing..."],
--     "humor": ["Your vault called — it wants this", "The margin on that is *chef's kiss*"]
--   },
--   "running_jokes": [
--     { "joke": "user always finds coins in couch cushions", "last_used": "2026-02-10", "times_used": 3 },
--   ],
--   "callback_references": [
--     { "reference": "that time they found the $500 misprint", "context": "big win story", "created": "2026-01-15" }
--   ],
--   "verbal_tics": ["honestly", "here's the thing"],
--   "farewell_style": "See you out there",
--   "evolved_at": "2026-02-16T00:00:00Z"
-- }

COMMENT ON COLUMN oracle_identity.voice_character IS 'Persistent character traits: catchphrases, running jokes, callbacks, signature expressions. Evolves via LLM analysis every ~10 conversations.';
