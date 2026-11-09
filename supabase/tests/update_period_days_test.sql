BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(10);

-- Create two synthetic users.
-- These exist only for the duration of this transaction.
INSERT INTO auth.users (id, email)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'period-days-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'period-days-b@example.test');

-- Force deleting one sentinel date to fail, so we can check
-- that an insert made earlier in the same call is rolled back.
CREATE FUNCTION pg_temp.fail_sentinel_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.date = '2020-01-15' THEN
    RAISE EXCEPTION 'forced failure';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER fail_sentinel_delete
BEFORE DELETE ON public.period_days
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_sentinel_delete();

-- Simulate User A (authenticated) and seed their data.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

INSERT INTO public.period_days (user_id, date)
VALUES
  ('11111111-1111-4111-8111-111111111111', '2026-10-01'),
  ('11111111-1111-4111-8111-111111111111', '2026-10-02');

INSERT INTO public.daily_logs (user_id, date, mood)
VALUES ('11111111-1111-4111-8111-111111111111', '2026-10-01', 'happy');

-- Tests 1-3: only the requested days change, and daily logs are kept.
SELECT lives_ok(
  $$SELECT public.update_period_days(
      ARRAY['2026-10-03']::date[], ARRAY['2026-10-01']::date[])$$,
  'A can add and remove days together'
);

SELECT results_eq(
  'SELECT date FROM public.period_days ORDER BY date',
  ARRAY['2026-10-02', '2026-10-03']::date[],
  'Only the requested days changed'
);

SELECT results_eq(
  $$SELECT count(*) FROM public.daily_logs WHERE date = '2026-10-01'$$,
  ARRAY[1::bigint],
  'Removing a period day keeps its daily log'
);

-- Tests 4-5: invalid changes are rejected.
SELECT throws_ok(
  $$SELECT public.update_period_days(
      ARRAY['2026-10-05']::date[], ARRAY['2026-10-05']::date[])$$,
  'P0001', 'Contradictory date changes',
  'A date cannot be both added and removed'
);

SELECT throws_ok(
  $$SELECT public.update_period_days(ARRAY[current_date + 2], '{}')$$,
  'P0001', 'Period days cannot be in the future',
  'A future day is rejected'
);

-- Tests 6-7: a failure while deleting undoes the insert.
INSERT INTO public.period_days (user_id, date)
VALUES ('11111111-1111-4111-8111-111111111111', '2020-01-15');

SELECT throws_ok(
  $$SELECT public.update_period_days(
      ARRAY['2026-10-10']::date[], ARRAY['2020-01-15']::date[])$$,
  'P0001', 'forced failure',
  'A failure while deleting fails the whole call'
);

SELECT is_empty(
  $$SELECT 1 FROM public.period_days WHERE date = '2026-10-10'$$,
  'The insert is rolled back when the delete fails'
);

-- Tests 8-9: B cannot remove A's days.
SET LOCAL request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

SELECT lives_ok(
  $$SELECT public.update_period_days('{}', ARRAY['2026-10-02']::date[])$$,
  'B removing a date B does not have is a no-op'
);

SET LOCAL request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

SELECT isnt_empty(
  $$SELECT 1 FROM public.period_days WHERE date = '2026-10-02'$$,
  'A still has the day B tried to remove'
);

-- Test 10: signed-out callers have no execute permission.
SET LOCAL ROLE anon;

SELECT throws_ok(
  $$SELECT public.update_period_days(ARRAY['2026-10-06']::date[], '{}')$$,
  '42501', NULL,
  'Signed-out callers cannot run the function'
);

SELECT * FROM finish();

-- Clean up all test data automatically.
ROLLBACK;
