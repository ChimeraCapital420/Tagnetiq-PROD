-- Sprint N Final: Gamification + Feedback tables
-- Run in Supabase SQL Editor

-- ═══════════════════════════════════════════════════════════
-- GAMIFICATION
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_gamification (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_points INTEGER DEFAULT 0,
  total_scans INTEGER DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  total_profit NUMERIC(12,2) DEFAULT 0,
  total_listings INTEGER DEFAULT 0,
  lessons_completed INTEGER DEFAULT 0,
  paths_completed INTEGER DEFAULT 0,
  feedback_given INTEGER DEFAULT 0,
  introductions_accepted INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  badges_earned TEXT[] DEFAULT '{}',
  unique_categories TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gamification_user ON user_gamification(user_id);
CREATE INDEX IF NOT EXISTS idx_gamification_points ON user_gamification(total_points DESC);

ALTER TABLE user_gamification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own gamification" ON user_gamification;
CREATE POLICY "Users can view own gamification"
  ON user_gamification FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Leaderboard is public" ON user_gamification;
CREATE POLICY "Leaderboard is public"
  ON user_gamification FOR SELECT
  USING (true);

GRANT ALL ON user_gamification TO service_role;

-- ═══════════════════════════════════════════════════════════
-- ORACLE FEEDBACK (thumbs up/down)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS oracle_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID,
  message_index INTEGER,
  message_excerpt TEXT DEFAULT '',
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user ON oracle_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON oracle_feedback(rating);

ALTER TABLE oracle_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own feedback" ON oracle_feedback;
CREATE POLICY "Users can view own feedback"
  ON oracle_feedback FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own feedback" ON oracle_feedback;
CREATE POLICY "Users can insert own feedback"
  ON oracle_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON oracle_feedback TO service_role;
