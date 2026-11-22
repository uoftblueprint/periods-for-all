BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(15);

INSERT INTO auth.users (id, email)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'spoon-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'spoon-b@example.test');

-- User A saves energy and a completed task through the store functions.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

SELECT public.set_spoon_starting_energy(
  '{"operationId": "a-energy", "date": "2026-11-20", "expectedRevision": 0, "amount": 4}',
  '11111111-1111-4111-8111-111111111111'
);
SELECT set_config('test.task', public.create_spoon_task(
  '{"operationId": "a-task", "date": "2026-11-20", "expectedRevision": 1,
    "draft": {"date": "2026-11-20", "name": "Shower", "kind": "spend", "amount": 1}}',
  NULL, '11111111-1111-4111-8111-111111111111'
) -> 0 -> 'tasks' -> 0 ->> 'id', true);
SELECT public.complete_spoon_task(
  jsonb_build_object('operationId', 'a-complete', 'date', '2026-11-20', 'expectedRevision', 2,
                     'taskId', current_setting('test.task')),
  '11111111-1111-4111-8111-111111111111'
);

-- Test 1: A can read their own rows, so the empty results below are meaningful.
SELECT results_eq(
  $$SELECT (SELECT count(*) FROM public.spoon_days)
         + (SELECT count(*) FROM public.spoon_tasks)
         + (SELECT count(*) FROM public.spoon_effects)$$,
  ARRAY[3::bigint],
  'A can read their own spoon rows'
);

-- Tests 2-4: clients cannot write the tables directly, even their own rows.
SELECT throws_ok(
  $$INSERT INTO public.spoon_days (user_id, date, starting_energy, balance)
    VALUES ('11111111-1111-4111-8111-111111111111', '2026-11-21', 5, 5)$$,
  '42501', NULL, 'A cannot insert spoon days directly'
);
SELECT throws_ok(
  $$UPDATE public.spoon_days SET balance = 5$$,
  '42501', NULL, 'A cannot set their balance directly'
);
SELECT throws_ok(
  $$DELETE FROM public.spoon_effects$$,
  '42501', NULL, 'A cannot delete effect history directly'
);

-- Test 5: operation records and private helpers are not reachable.
SELECT throws_ok(
  $$SELECT * FROM public.spoon_operations$$,
  '42501', NULL, 'A cannot read operation records'
);
SELECT throws_ok(
  $$SELECT spoons_private.bump('11111111-1111-4111-8111-111111111111', '2026-11-20')$$,
  '42501', NULL, 'A cannot call private helpers'
);

-- Switch to User B.
SET LOCAL request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

-- Test 7: B cannot read A's rows.
SELECT is_empty(
  $$SELECT user_id FROM public.spoon_days
    UNION ALL SELECT user_id FROM public.spoon_tasks
    UNION ALL SELECT user_id FROM public.spoon_effects$$,
  'B cannot read A spoon rows'
);

-- Test 8: B's view of the same date is their own empty day.
SELECT is(
  public.get_spoon_day('2026-11-20', '22222222-2222-4222-8222-222222222222'),
  '{"date": "2026-11-20", "startingEnergy": null, "balance": null, "revision": 0, "tasks": [], "effects": []}'::jsonb,
  'B sees an unanswered day, not A''s record'
);

-- Tests 9-10: B cannot use A's user ID.
SELECT throws_ok(
  $$SELECT public.get_spoon_day('2026-11-20', '11111111-1111-4111-8111-111111111111')$$,
  '42501', NULL, 'B cannot read with A''s user ID'
);
SELECT throws_ok(
  $$SELECT public.set_spoon_starting_energy(
      '{"operationId": "b-forged", "date": "2026-11-20", "expectedRevision": 3, "amount": 0}',
      '11111111-1111-4111-8111-111111111111')$$,
  '42501', NULL, 'B cannot write with A''s user ID'
);

-- Tests 11-12: B cannot undo or delete A's task by its ID.
SELECT throws_ok(
  format($$SELECT public.undo_spoon_completion(
      '{"operationId": "b-undo", "date": "2026-11-20", "expectedRevision": 0, "taskId": %s}',
      '22222222-2222-4222-8222-222222222222')$$, to_jsonb(current_setting('test.task'))),
  'SP404', NULL, 'B cannot undo A''s task'
);
SELECT throws_ok(
  format($$SELECT public.delete_spoon_task(
      '{"operationId": "b-delete", "date": "2026-11-20", "expectedRevision": 0, "taskId": %s}',
      '22222222-2222-4222-8222-222222222222')$$, to_jsonb(current_setting('test.task'))),
  'SP404', NULL, 'B cannot delete A''s task'
);

-- Test 13: B reusing A's operation ID does not replay A's result.
SELECT is(
  public.set_spoon_starting_energy(
    '{"operationId": "a-energy", "date": "2026-11-20", "expectedRevision": 0, "amount": 2}',
    '22222222-2222-4222-8222-222222222222'
  ) -> 0 -> 'startingEnergy',
  '2'::jsonb,
  'Operation IDs are scoped to each account'
);

-- Test 14: signed-in role with no user is rejected.
SET LOCAL request.jwt.claim.sub = '';
SELECT throws_ok(
  $$SELECT public.get_spoon_day('2026-11-20', NULL)$$,
  '42501', 'Authentication required', 'A request without a user is rejected'
);

-- Test 15: signed-out callers cannot run the functions.
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT public.get_spoon_day('2026-11-20', '11111111-1111-4111-8111-111111111111')$$,
  '42501', NULL, 'Signed-out callers are denied'
);

SELECT * FROM finish();
ROLLBACK;
