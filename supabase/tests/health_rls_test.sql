
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(18);

-- Create two synthetic users.
-- These exist only for the duration of this transaction.
INSERT INTO auth.users (id, email)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'rls-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'rls-b@example.test');

-- Simulate User B (authenticated).
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

-- Test 1: B cannot create a setup row belonging to A.
-- This runs before A creates their setup row,
-- avoiding a primary-key conflict.
SELECT throws_ok(
  $$INSERT INTO public.period_setup (user_id)
    VALUES ('11111111-1111-4111-8111-111111111111')$$,
  '42501', NULL,
  'B cannot insert setup for A'
);

-- Switch to User A.
SET LOCAL request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

-- Tests 2-4: A can insert their own records.
SELECT results_eq(
  $$INSERT INTO public.period_days (user_id, date)
    VALUES ('11111111-1111-4111-8111-111111111111', '2026-11-01')
    RETURNING user_id$$,
  ARRAY['11111111-1111-4111-8111-111111111111'::uuid],
  'A can insert period day'
);

SELECT results_eq(
  $$INSERT INTO public.daily_logs (user_id, date, mood, flow)
    VALUES ('11111111-1111-4111-8111-111111111111',
            '2026-11-01', 'happy', 'none')
    RETURNING user_id$$,
  ARRAY['11111111-1111-4111-8111-111111111111'::uuid],
  'A can insert daily log'
);

SELECT results_eq(
  $$INSERT INTO public.period_setup (user_id, cycle_length)
    VALUES ('11111111-1111-4111-8111-111111111111', 28)
    RETURNING user_id$$,
  ARRAY['11111111-1111-4111-8111-111111111111'::uuid],
  'A can insert period setup'
);

-- Tests 5-7: A can read their own records.
SELECT results_eq(
  'SELECT count(*) FROM public.period_days',
  ARRAY[1::bigint], 'A can read period day'
);

SELECT results_eq(
  'SELECT count(*) FROM public.daily_logs',
  ARRAY[1::bigint], 'A can read daily log'
);

SELECT results_eq(
  'SELECT count(*) FROM public.period_setup',
  ARRAY[1::bigint], 'A can read period setup'
);

-- Switch to User B.
SET LOCAL request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

-- Tests 8-10: B cannot read A's records.
SELECT is_empty(
  'SELECT * FROM public.period_days',
  'B cannot read A period days'
);

SELECT is_empty(
  'SELECT * FROM public.daily_logs',
  'B cannot read A daily logs'
);

SELECT is_empty(
  'SELECT * FROM public.period_setup',
  'B cannot read A period setup'
);

-- Tests 11-13: B cannot update A's records.
SELECT is_empty(
  $$UPDATE public.period_days SET date = '2026-11-02'
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
    RETURNING 1$$,
  'B cannot update A period days'
);

SELECT is_empty(
  $$UPDATE public.daily_logs SET mood = 'sad'
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
    RETURNING 1$$,
  'B cannot update A daily logs'
);

SELECT is_empty(
  $$UPDATE public.period_setup SET cycle_length = 30
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
    RETURNING 1$$,
  'B cannot update A period setup'
);

-- Tests 14-16: B cannot delete A's records.
SELECT is_empty(
  $$DELETE FROM public.period_days
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
    RETURNING 1$$,
  'B cannot delete A period days'
);

SELECT is_empty(
  $$DELETE FROM public.daily_logs
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
    RETURNING 1$$,
  'B cannot delete A daily logs'
);

SELECT is_empty(
  $$DELETE FROM public.period_setup
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
    RETURNING 1$$,
  'B cannot delete A period setup'
);

-- Tests 17-18: B cannot forge A's user_id on INSERT.
SELECT throws_ok(
  $$INSERT INTO public.period_days (user_id, date)
    VALUES ('11111111-1111-4111-8111-111111111111', '2026-11-03')$$,
  '42501', NULL,
  'B cannot insert A period day'
);

SELECT throws_ok(
  $$INSERT INTO public.daily_logs (user_id, date)
    VALUES ('11111111-1111-4111-8111-111111111111', '2026-11-03')$$,
  '42501', NULL,
  'B cannot insert A daily log'
);

SELECT * FROM finish();

-- Clean up all test data automatically.
ROLLBACK;