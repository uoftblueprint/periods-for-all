BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(15);

-- One synthetic user with a setup row and a daily log.
-- These exist only for the duration of this transaction.
INSERT INTO auth.users (id, email)
VALUES ('11111111-1111-4111-8111-111111111111', 'health-values@example.test');

INSERT INTO public.period_setup (user_id)
VALUES ('11111111-1111-4111-8111-111111111111');

INSERT INTO public.daily_logs (user_id, date, mood, flow, physical_symptoms)
VALUES ('11111111-1111-4111-8111-111111111111', '2026-10-01', 'happy', 'none', '{}');

-- Tests 1-4: setup values outside the ranges are rejected.
SELECT throws_ok(
  'UPDATE public.period_setup SET cycle_length = 20',
  '23514', NULL,
  'Cycle length below 21 is rejected'
);

SELECT throws_ok(
  'UPDATE public.period_setup SET cycle_length = 46',
  '23514', NULL,
  'Cycle length above 45 is rejected'
);

SELECT throws_ok(
  'UPDATE public.period_setup SET period_length = 0',
  '23514', NULL,
  'Period length below 1 is rejected'
);

SELECT throws_ok(
  'UPDATE public.period_setup SET period_length = 13',
  '23514', NULL,
  'Period length above 12 is rejected'
);

-- Tests 5-7: the edge values and null are allowed.
SELECT lives_ok(
  'UPDATE public.period_setup SET cycle_length = 21, period_length = 1',
  'The lowest values are allowed'
);

SELECT lives_ok(
  'UPDATE public.period_setup SET cycle_length = 45, period_length = 12',
  'The highest values are allowed'
);

SELECT lives_ok(
  'UPDATE public.period_setup SET cycle_length = NULL, period_length = NULL',
  'Unanswered values are allowed'
);

-- Tests 8-11: unknown daily log values are rejected.
SELECT throws_ok(
  $$UPDATE public.daily_logs SET mood = 'angry'$$,
  '23514', NULL,
  'An unknown mood is rejected'
);

SELECT throws_ok(
  $$UPDATE public.daily_logs SET flow = 'medium'$$,
  '23514', NULL,
  'An unknown flow is rejected'
);

SELECT throws_ok(
  $$UPDATE public.daily_logs SET physical_symptoms = ARRAY['toothache']$$,
  '23514', NULL,
  'An unknown physical symptom is rejected'
);

SELECT throws_ok(
  $$UPDATE public.daily_logs SET emotional_symptoms = ARRAY['boredom']$$,
  '23514', NULL,
  'An unknown emotional symptom is rejected'
);

-- Test 12: the store's upsert of only the reflection keeps the other answers,
-- including No Flow, explicit no symptoms and unanswered emotional symptoms.
INSERT INTO public.daily_logs (user_id, date, reflection)
VALUES ('11111111-1111-4111-8111-111111111111', '2026-10-01', 'A calm day')
ON CONFLICT (user_id, date) DO UPDATE SET reflection = EXCLUDED.reflection;

SELECT results_eq(
  $$SELECT mood::text, flow::text, physical_symptoms, emotional_symptoms IS NULL, reflection
    FROM public.daily_logs$$,
  $$VALUES ('happy', 'none', '{}'::text[], true, 'A calm day')$$,
  'Changing only the reflection keeps the other answers'
);

-- Tests 13-15: future dates are rejected in every table.
SELECT throws_ok(
  $$INSERT INTO public.period_days (user_id, date)
    VALUES ('11111111-1111-4111-8111-111111111111', current_date + 2)$$,
  'P0001', 'Dates cannot be in the future',
  'A future period day is rejected'
);

SELECT throws_ok(
  $$INSERT INTO public.daily_logs (user_id, date)
    VALUES ('11111111-1111-4111-8111-111111111111', current_date + 2)$$,
  'P0001', 'Dates cannot be in the future',
  'A future daily log is rejected'
);

SELECT throws_ok(
  'UPDATE public.period_setup SET last_period_start = current_date + 2',
  'P0001', 'Dates cannot be in the future',
  'A future last period start is rejected'
);

SELECT * FROM finish();

-- Clean up all test data automatically.
ROLLBACK;
