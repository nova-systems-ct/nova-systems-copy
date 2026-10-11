-- =============================================================================================
-- Nova Sales Team platform — part 2 of 5: ACADEMY v2 (policy versions, lesson progress, attempt limits,
-- exercises with feedback, practical submissions, revocable certificates). Additive. NOT applied to production.
-- Depends on: part 1 (sales_config, forbid_update_delete), academy-migration-standalone.sql.
-- =============================================================================================

-- ---- programs: versioned content + the practical brief -------------------------------------------
ALTER TABLE academy_programs ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE academy_programs ADD COLUMN IF NOT EXISTS content_review_status TEXT NOT NULL DEFAULT 'pending_owner_review'
  CHECK (content_review_status IN ('pending_owner_review', 'approved'));
ALTER TABLE academy_programs ADD COLUMN IF NOT EXISTS learning_objectives TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE academy_programs ADD COLUMN IF NOT EXISTS practical_prompt TEXT;
ALTER TABLE academy_programs ADD COLUMN IF NOT EXISTS practical_rubric JSONB NOT NULL DEFAULT '[]';   -- [{key,label,description}]
ALTER TABLE academy_programs ADD COLUMN IF NOT EXISTS content_reviewed_by UUID;
ALTER TABLE academy_programs ADD COLUMN IF NOT EXISTS content_reviewed_at TIMESTAMPTZ;

-- ---- lesson progress: which lessons were actually completed (in order), and where to resume -------
CREATE TABLE IF NOT EXISTS academy_lesson_progress (
  enrollment_id  UUID NOT NULL REFERENCES academy_enrollments(id) ON DELETE CASCADE,
  lesson_order   INTEGER NOT NULL,
  completed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (enrollment_id, lesson_order)
);
ALTER TABLE academy_enrollments ADD COLUMN IF NOT EXISTS last_lesson_order INTEGER NOT NULL DEFAULT 0;   -- resume point
ALTER TABLE academy_enrollments ADD COLUMN IF NOT EXISTS attempts_reset_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE academy_enrollments ADD COLUMN IF NOT EXISTS locked_reason TEXT;

-- ---- quiz attempts remember WHICH policy version graded them ---------------------------------------
ALTER TABLE academy_quiz_attempts ADD COLUMN IF NOT EXISTS policy_config_id UUID REFERENCES sales_config(id);
ALTER TABLE academy_quiz_attempts ADD COLUMN IF NOT EXISTS policy_snapshot JSONB NOT NULL DEFAULT '{}';
ALTER TABLE academy_quiz_attempts ADD COLUMN IF NOT EXISTS policy_provisional BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE academy_quiz_attempts ADD COLUMN IF NOT EXISTS question_results JSONB NOT NULL DEFAULT '[]';   -- [{order, correct, explanation?}]
ALTER TABLE academy_quiz_attempts ADD COLUMN IF NOT EXISTS counted BOOLEAN NOT NULL DEFAULT true;         -- false once an owner resets attempts (history kept)

-- ---- exercises (practice with immediate self-check feedback) ---------------------------------------
CREATE TABLE IF NOT EXISTS academy_exercises (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    UUID NOT NULL REFERENCES academy_programs(id) ON DELETE CASCADE,
  order_index   INTEGER NOT NULL,
  lesson_order  INTEGER,
  title         TEXT NOT NULL,
  prompt        TEXT NOT NULL,
  self_check    JSONB NOT NULL DEFAULT '[]',     -- ["Did you ...?"] shown AFTER the learner submits
  model_answer  TEXT,                              -- shown only AFTER the learner submits their own
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, order_index)
);
CREATE TABLE IF NOT EXISTS academy_exercise_responses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id  UUID NOT NULL REFERENCES academy_enrollments(id) ON DELETE CASCADE,
  exercise_id    UUID NOT NULL REFERENCES academy_exercises(id) ON DELETE CASCADE,
  response       TEXT NOT NULL,
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, exercise_id)
);

-- ---- practical submissions (the work a reviewer approves — not a bare "approve" button) --------------
CREATE TABLE IF NOT EXISTS academy_practical_submissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id  UUID NOT NULL REFERENCES academy_enrollments(id) ON DELETE CASCADE,
  attempt_no     INTEGER NOT NULL,
  response       TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'changes_requested', 'rejected')),
  reviewer_id    UUID,
  rubric_scores  JSONB NOT NULL DEFAULT '{}',
  feedback       TEXT,
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at    TIMESTAMPTZ,
  UNIQUE (enrollment_id, attempt_no)
);
CREATE UNIQUE INDEX IF NOT EXISTS academy_practical_one_open ON academy_practical_submissions (enrollment_id) WHERE status = 'submitted';

-- ---- certificates: versioned, revocable, minimal public data --------------------------------------
ALTER TABLE academy_certificates ADD COLUMN IF NOT EXISTS program_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE academy_certificates ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'revoked'));
ALTER TABLE academy_certificates ADD COLUMN IF NOT EXISTS holder_full_name TEXT;       -- shown to the holder only
ALTER TABLE academy_certificates ADD COLUMN IF NOT EXISTS holder_display TEXT;         -- what public verification shows, e.g. "Jane D."
ALTER TABLE academy_certificates ADD COLUMN IF NOT EXISTS policy_config_id UUID REFERENCES sales_config(id);
ALTER TABLE academy_certificates ADD COLUMN IF NOT EXISTS policy_provisional BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE academy_certificates ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE academy_certificates ADD COLUMN IF NOT EXISTS revoked_by UUID;
ALTER TABLE academy_certificates ADD COLUMN IF NOT EXISTS revoked_reason TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS academy_certificates_one_per_enrollment ON academy_certificates (enrollment_id);

-- ---- default policy: DRAFT awaiting the owner's approval --------------------------------------------
-- 80% was a PROPOSED default, never approved. It is seeded as pending_approval so the owner sees it and decides;
-- until a version is approved, grading uses these numbers but everything derived from them is labelled provisional.
INSERT INTO sales_config (key, version, status, value, change_note)
VALUES ('academy_policy', 1, 'pending_approval',
  '{"pass_threshold_pct": 80, "max_attempts": 3, "cooldown_hours": 0, "require_lessons_before_quiz": true, "practical_max_attempts": 3, "reveal_explanations": true}'::jsonb,
  'Proposed default carried over from the original build prompt. NOT approved.')
ON CONFLICT (key, version) DO NOTHING;

-- Owner's decision on lesson/quiz content quality is tracked per program (content_review_status).
ALTER TABLE academy_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_exercise_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_practical_submissions ENABLE ROW LEVEL SECURITY;
