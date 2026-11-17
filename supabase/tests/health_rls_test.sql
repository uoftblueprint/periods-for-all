BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(13);

-- Create two synthetic users.
-- These exist only for the duration of this transaction.
INSERT INTO auth.users (id, email)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'rls-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'rls-b@example.test');

-- Simulate User A (authenticated) and seed one row per table.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

INSERT INTO public.period_days (user_id, date)
VALUES ('11111111-1111-4111-8111-111111111111', '2026-11-01');

INSERT INTO public.daily_logs (user_id, date, mood, flow)
VALUES ('11111111-1111-4111-8111-111111111111', '2026-11-01', 'happy', 'none');

INSERT INTO public.period_setup (user_id, cycle_length)
VALUES ('11111111-1111-4111-8111-111111111111', 28);

-- Test 1: A can read their own rows, so the empty results below are meaningful.
SELECT results_eq(
  $$SELECT (SELECT count(*) FROM public.period_days)
         + (SELECT count(*) FROM public.daily_logs)
         + (SELECT count(*) FROM public.period_setup)$$,
  ARRAY[3::bigint],
  'A can read their own rows'
);

-- Switch to User B.
SET LOCAL request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

-- Test 2: B cannot read A's rows.
SELECT is_empty(
  $$SELECT user_id FROM public.period_days
    UNION ALL SELECT user_id FROM public.daily_logs
    UNION ALL SELECT user_id FROM public.period_setup$$,
  'B cannot read A rows'
);

-- Tests 3-5: B cannot update A's rows.
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

-- Tests 6-8: B cannot delete A's rows.
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

-- Tests 9-11: B cannot insert rows with A's forged user ID.
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

SELECT throws_ok(
  $$INSERT INTO public.period_setup (user_id)
    VALUES ('11111111-1111-4111-8111-111111111111')$$,
  '42501', NULL,
  'B cannot insert A period setup'
);

-- Tests 12-13: signed-out access is denied.
SET LOCAL ROLE anon;

SELECT is_empty(
  $$SELECT user_id FROM public.period_days
    UNION ALL SELECT user_id FROM public.daily_logs
    UNION ALL SELECT user_id FROM public.period_setup$$,
  'Signed-out users cannot read any rows'
);

SELECT throws_ok(
  $$INSERT INTO public.period_days (user_id, date)
    VALUES ('11111111-1111-4111-8111-111111111111', '2026-11-04')$$,
  '42501', NULL,
  'Signed-out users cannot insert rows'
);

SELECT * FROM finish();

-- Clean up all test data automatically.
ROLLBACK;
