-- FILE: supabase/sprint-n-migration.sql
-- Sprint N: Memory, Trust, Learning, Introductions
-- Run this BEFORE deploying the new code
-- Safe: all CREATE IF NOT EXISTS, won't break existing data

-- =============================================================================
-- ORACLE MEMORY SUMMARIES — compressed conversation memories
-- =============================================================================
CREATE TABLE IF NOT EXISTS oracle_memory_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID REFERENCES oracle_conversations(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  topics TEXT[] DEFAULT '{}',
  interests_revealed JSONB DEFAULT '[]',
  promises_made JSONB DEFAULT '[]',
  expertise_signals JSONB DEFAULT '{}',
  emotional_markers JSONB DEFAULT '[]',
  items_discussed JSONB DEFAULT '[]',
  token_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_user ON oracle_memory_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_topics ON oracle_memory_summaries USING GIN(topics);
CREATE INDEX IF NOT EXISTS idx_memory_created ON oracle_memory_summaries(user_id, created_at DESC);

-- =============================================================================
-- ORACLE IDENTITY — add trust_metrics and voice_profile columns
-- (oracle_identity table should already exist from earlier sprints)
-- =============================================================================
DO $$
BEGIN
  -- Add trust_metrics column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oracle_identity' AND column_name = 'trust_metrics'
  ) THEN
    ALTER TABLE oracle_identity ADD COLUMN trust_metrics JSONB DEFAULT NULL;
  END IF;

  -- Add voice_profile column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oracle_identity' AND column_name = 'voice_profile'
  ) THEN
    ALTER TABLE oracle_identity ADD COLUMN voice_profile JSONB DEFAULT NULL;
  END IF;
END $$;

-- =============================================================================
-- ORACLE LEARNING PROGRESS — tracks structured learning paths
-- =============================================================================
CREATE TABLE IF NOT EXISTS oracle_learning_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic TEXT NOT NULL,
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER DEFAULT 5,
  mode TEXT DEFAULT 'general',
  previous_answers JSONB DEFAULT '[]',
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_learning_user ON oracle_learning_progress(user_id);

-- =============================================================================
-- ORACLE INTRODUCTIONS — double opt-in user matching
-- =============================================================================
CREATE TABLE IF NOT EXISTS oracle_introductions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  initiator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shared_interests TEXT[] DEFAULT '{}',
  match_reason TEXT,
  initiator_consent BOOLEAN DEFAULT TRUE,
  target_consent BOOLEAN DEFAULT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_intro_target ON oracle_introductions(target_id, status);
CREATE INDEX IF NOT EXISTS idx_intro_initiator ON oracle_introductions(initiator_id, status);

-- =============================================================================
-- RLS POLICIES — secure all new tables
-- =============================================================================

-- Memory summaries: users can only see their own
ALTER TABLE oracle_memory_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own memory summaries" ON oracle_memory_summaries;
CREATE POLICY "Users can view own memory summaries"
  ON oracle_memory_summaries FOR SELECT
  USING (auth.uid() = user_id);

-- Learning progress: users can only see their own
ALTER TABLE oracle_learning_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own learning progress" ON oracle_learning_progress;
CREATE POLICY "Users can view own learning progress"
  ON oracle_learning_progress FOR SELECT
  USING (auth.uid() = user_id);

-- Introductions: users can see intros they're part of
ALTER TABLE oracle_introductions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own introductions" ON oracle_introductions;
CREATE POLICY "Users can view own introductions"
  ON oracle_introductions FOR SELECT
  USING (auth.uid() = initiator_id OR auth.uid() = target_id);

-- =============================================================================
-- SERVICE ROLE BYPASS — API routes use service role key
-- These policies allow the supabaseAdmin client to do everything
-- =============================================================================

-- Grant service role full access (these run via API, not client-side)
GRANT ALL ON oracle_memory_summaries TO service_role;
GRANT ALL ON oracle_learning_progress TO service_role;
GRANT ALL ON oracle_introductions TO service_role;
