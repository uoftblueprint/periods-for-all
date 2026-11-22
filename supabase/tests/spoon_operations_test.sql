BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(24);

INSERT INTO auth.users (id, email)
VALUES ('11111111-1111-4111-8111-111111111111', 'spoon-ops@example.test');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

------------------------------------------------------------------------------
-- Retries and stale edits
------------------------------------------------------------------------------
SELECT public.set_spoon_starting_energy(
  '{"operationId": "e-3", "date": "2026-11-05", "expectedRevision": 0, "amount": 3}',
  '11111111-1111-4111-8111-111111111111'
);
SELECT set_config('test.task', public.create_spoon_task(
  '{"operationId": "c-cook", "date": "2026-11-05", "expectedRevision": 1,
    "draft": {"date": "2026-11-05", "name": "Cook", "kind": "spend", "amount": 2}}',
  NULL, '11111111-1111-4111-8111-111111111111'
) -> 0 -> 'tasks' -> 0 ->> 'id', true);
SELECT set_config('test.complete', jsonb_build_object(
  'operationId', 'k-cook', 'date', '2026-11-05', 'expectedRevision', 2, 'taskId', current_setting('test.task')
)::text, true);

SELECT set_config('test.first', public.complete_spoon_task(
  current_setting('test.complete')::jsonb, '11111111-1111-4111-8111-111111111111'
)::text, true);

-- Test 1: retrying the identical completion returns the same day without spending again.
SELECT is(
  public.complete_spoon_task(current_setting('test.complete')::jsonb, '11111111-1111-4111-8111-111111111111'),
  current_setting('test.first')::jsonb,
  'Retrying a completion returns the same result'
);
SELECT is(
  (SELECT ARRAY[balance::int, revision, (SELECT count(*)::int FROM public.spoon_effects)]
   FROM public.spoon_days WHERE date = '2026-11-05'),
  ARRAY[1, 3, 1],
  'Retrying a completion does not double its energy effect'
);

-- Test 3: key order does not make a retry look different.
SELECT is(
  public.complete_spoon_task(
    jsonb_build_object('taskId', current_setting('test.task'), 'expectedRevision', 2,
                       'date', '2026-11-05', 'operationId', 'k-cook'),
    '11111111-1111-4111-8111-111111111111'
  ) -> 0 -> 'balance',
  '1'::jsonb,
  'A retry with reordered keys is still the same request'
);

-- Test 4: the same operation ID with a different request is a conflict.
SELECT throws_ok(
  $$SELECT public.set_spoon_starting_energy(
      '{"operationId": "k-cook", "date": "2026-11-05", "expectedRevision": 3, "amount": 5}',
      '11111111-1111-4111-8111-111111111111')$$,
  'SP409', 'This operation ID has already been used for another request.', 'Reused operation ID is rejected'
);

-- Undo retried twice reverses once.
SELECT set_config('test.undo', jsonb_build_object(
  'operationId', 'u-cook', 'date', '2026-11-05', 'expectedRevision', 3, 'taskId', current_setting('test.task')
)::text, true);
SELECT public.undo_spoon_completion(current_setting('test.undo')::jsonb, '11111111-1111-4111-8111-111111111111');
SELECT public.undo_spoon_completion(current_setting('test.undo')::jsonb, '11111111-1111-4111-8111-111111111111');
SELECT is(
  (SELECT ARRAY[balance::int, revision, (SELECT count(*)::int FROM public.spoon_effects)]
   FROM public.spoon_days WHERE date = '2026-11-05'),
  ARRAY[3, 4, 2],
  'Retrying an undo does not double its energy effect'
);

-- Test 6: a stale revision is rejected (lost-update protection).
SELECT throws_ok(
  $$SELECT public.set_spoon_starting_energy(
      '{"operationId": "e-stale", "date": "2026-11-05", "expectedRevision": 2, "amount": 5}',
      '11111111-1111-4111-8111-111111111111')$$,
  'SP409', 'This day changed. Reload it and try again.', 'Stale revision is rejected'
);

-- Tests 7-8: a failed save changes nothing and does not use up its operation ID.
SELECT throws_ok(
  $$SELECT public.set_spoon_starting_energy(
      '{"operationId": "e-retry-later", "date": "2026-11-05", "expectedRevision": 4, "amount": 9}',
      '11111111-1111-4111-8111-111111111111')$$,
  'SP400', NULL, 'Invalid save fails'
);
SELECT is(
  public.set_spoon_starting_energy(
    '{"operationId": "e-retry-later", "date": "2026-11-05", "expectedRevision": 4, "amount": 5}',
    '11111111-1111-4111-8111-111111111111'
  ) -> 0 -> 'revision',
  '5'::jsonb,
  'Failed save left revision 4 and the operation ID unused'
);

-- Test 9: setting the same energy again is a no-op that keeps the revision.
SELECT is(
  public.set_spoon_starting_energy(
    '{"operationId": "e-same", "date": "2026-11-05", "expectedRevision": 5, "amount": 5}',
    '11111111-1111-4111-8111-111111111111'
  ) -> 0 -> 'revision',
  '5'::jsonb,
  'No-op keeps the revision'
);

-- Test 10: tasks keep creation order.
SELECT public.create_spoon_task(
  '{"operationId": "c-second", "date": "2026-11-05", "expectedRevision": 5,
    "draft": {"date": "2026-11-05", "name": "Read", "kind": "recharge", "amount": 1}}',
  NULL, '11111111-1111-4111-8111-111111111111'
);
SELECT is(
  ARRAY(SELECT jsonb_array_elements(
    public.get_spoon_day('2026-11-05', '11111111-1111-4111-8111-111111111111') -> 'tasks') ->> 'name'),
  ARRAY['Cook', 'Read'],
  'Tasks are returned in creation order'
);

-- Test 11: moving a task to another day through update checks both revisions.
SELECT throws_ok(
  format($$SELECT public.update_spoon_task(
      '{"operationId": "move-stale", "date": "2026-11-05", "expectedRevision": 6, "taskId": %s,
        "expectedDestinationRevision": 3,
        "draft": {"date": "2026-11-06", "name": "Cook", "kind": "spend", "amount": 2}}',
      '11111111-1111-4111-8111-111111111111')$$, to_jsonb(current_setting('test.task'))),
  'SP409', NULL, 'Rescheduling with a stale destination revision is rejected'
);
SELECT is(
  ARRAY(SELECT d ->> 'date' || ':' || (d ->> 'revision') FROM jsonb_array_elements(public.update_spoon_task(
    jsonb_build_object('operationId', 'move-ok', 'date', '2026-11-05', 'expectedRevision', 6,
                       'taskId', current_setting('test.task'), 'expectedDestinationRevision', 0,
                       'draft', jsonb_build_object('date', '2026-11-06', 'name', 'Cook', 'kind', 'spend', 'amount', 2)),
    '11111111-1111-4111-8111-111111111111')) AS d),
  ARRAY['2026-11-05:7', '2026-11-06:1'],
  'Rescheduling returns source then destination, each one revision on'
);

------------------------------------------------------------------------------
-- Daily reset and rollover. "Today" is the device's local date (p_today).
------------------------------------------------------------------------------
SELECT set_config('test.today', to_char((now() AT TIME ZONE 'utc')::date, 'YYYY-MM-DD'), true);
SELECT set_config('test.yesterday', to_char((now() AT TIME ZONE 'utc')::date - 1, 'YYYY-MM-DD'), true);

SELECT public.set_spoon_starting_energy(
  jsonb_build_object('operationId', 'y-energy', 'date', current_setting('test.yesterday'),
                     'expectedRevision', 0, 'amount', 2),
  '11111111-1111-4111-8111-111111111111'
);
SELECT set_config('test.unfinished', public.create_spoon_task(
  jsonb_build_object('operationId', 'y-unfinished', 'date', current_setting('test.yesterday'), 'expectedRevision', 1,
                     'draft', jsonb_build_object('date', current_setting('test.yesterday'),
                                                 'name', 'Water plants', 'kind', 'spend', 'amount', 1)),
  NULL, '11111111-1111-4111-8111-111111111111'
) -> 0 -> 'tasks' -> 0 ->> 'id', true);
SELECT set_config('test.finished', public.create_spoon_task(
  jsonb_build_object('operationId', 'y-finished', 'date', current_setting('test.yesterday'), 'expectedRevision', 2,
                     'draft', jsonb_build_object('date', current_setting('test.yesterday'),
                                                 'name', 'Email', 'kind', 'spend', 'amount', 1)),
  NULL, '11111111-1111-4111-8111-111111111111'
) -> 0 -> 'tasks' -> 1 ->> 'id', true);
SELECT public.complete_spoon_task(
  jsonb_build_object('operationId', 'y-complete', 'date', current_setting('test.yesterday'),
                     'expectedRevision', 3, 'taskId', current_setting('test.finished')),
  '11111111-1111-4111-8111-111111111111'
);

-- Test 13: a new day starts unanswered; nothing is copied from yesterday.
SELECT is(
  public.get_spoon_day(current_setting('test.today')::date, '11111111-1111-4111-8111-111111111111')
    - 'date',
  '{"startingEnergy": null, "balance": null, "revision": 0, "tasks": [], "effects": []}'::jsonb,
  'Today starts unanswered with no tasks'
);

-- Test 14: earlier records are preserved.
SELECT is(
  public.get_spoon_day(current_setting('test.yesterday')::date, '11111111-1111-4111-8111-111111111111') -> 'balance',
  '1'::jsonb,
  'Yesterday keeps its balance'
);

-- Test 15: only unfinished earlier tasks are offered, newest day first.
SELECT is(
  ARRAY(SELECT jsonb_array_elements(public.list_unfinished_previous_spoon_tasks(
    current_setting('test.today')::date, '11111111-1111-4111-8111-111111111111')) ->> 'name'),
  ARRAY['Water plants', 'Cook', 'Read'],
  'Unfinished earlier tasks are listed newest day first'
);

-- Test 16: a completed task cannot roll over.
SELECT throws_ok(
  format($$SELECT public.move_spoon_task_to_today(%L, %L, '11111111-1111-4111-8111-111111111111')$$,
    jsonb_build_object('operationId', 'move-done', 'date', current_setting('test.yesterday'),
                       'expectedRevision', 4, 'taskId', current_setting('test.finished'),
                       'destinationDate', current_setting('test.today'), 'expectedDestinationRevision', 0),
    current_setting('test.today')),
  'SP400', 'Undo completion before editing or moving this task.', 'Completed tasks cannot roll over'
);

-- Test 17: a device date far from the server's is rejected.
SELECT throws_ok(
  format($$SELECT public.move_spoon_task_to_today(%L, %L, '11111111-1111-4111-8111-111111111111')$$,
    jsonb_build_object('operationId', 'move-wrong-clock', 'date', current_setting('test.yesterday'),
                       'expectedRevision', 4, 'taskId', current_setting('test.unfinished'),
                       'destinationDate', '2030-01-01', 'expectedDestinationRevision', 0),
    '2030-01-01'),
  'SP400', 'Check that this device''s date is correct.', 'Implausible local date is rejected'
);

SELECT set_config('test.move', jsonb_build_object(
  'operationId', 'move-plants', 'date', current_setting('test.yesterday'), 'expectedRevision', 4,
  'taskId', current_setting('test.unfinished'),
  'destinationDate', current_setting('test.today'), 'expectedDestinationRevision', 0
)::text, true);
SELECT set_config('test.moved', public.move_spoon_task_to_today(
  current_setting('test.move')::jsonb, current_setting('test.today')::date,
  '11111111-1111-4111-8111-111111111111'
)::text, true);

-- Tests 18-20: the same task ID moves to today without touching energy.
SELECT is(
  current_setting('test.moved')::jsonb -> 1 -> 'tasks' -> 0 ->> 'id',
  current_setting('test.unfinished'),
  'The same task ID is moved to today'
);
SELECT is(
  ARRAY[current_setting('test.moved')::jsonb -> 0 -> 'balance', current_setting('test.moved')::jsonb -> 1 -> 'balance'],
  ARRAY['1'::jsonb, 'null'::jsonb],
  'Moving a task changes neither day''s energy'
);
SELECT is(
  jsonb_array_length(current_setting('test.moved')::jsonb -> 0 -> 'tasks'),
  1,
  'The task left yesterday'
);

-- Test 21: retrying the move after midnight returns the original two days and moves nothing.
SELECT is(
  ARRAY(SELECT d ->> 'date' FROM jsonb_array_elements(public.move_spoon_task_to_today(
    current_setting('test.move')::jsonb, current_setting('test.today')::date + 1,
    '11111111-1111-4111-8111-111111111111')) AS d),
  ARRAY[current_setting('test.yesterday'), current_setting('test.today')],
  'A retried move after midnight returns its original days'
);

-- Test 22: a task moves once; moving it again from yesterday finds nothing.
SELECT throws_ok(
  format($$SELECT public.move_spoon_task_to_today(%L, %L, '11111111-1111-4111-8111-111111111111')$$,
    jsonb_build_object('operationId', 'move-plants-again', 'date', current_setting('test.yesterday'),
                       'expectedRevision', 5, 'taskId', current_setting('test.unfinished'),
                       'destinationDate', current_setting('test.today'), 'expectedDestinationRevision', 1),
    current_setting('test.today')),
  'SP404', NULL, 'A task moves only once'
);

-- Tests 23-24: a draft without a date is scheduled on the device's today at save time.
SELECT is(
  public.create_spoon_task(
    jsonb_build_object('operationId', 'c-today', 'date', current_setting('test.today'), 'expectedRevision', 1,
                       'draft', jsonb_build_object('name', 'Stretch', 'kind', 'recharge', 'amount', 1)),
    current_setting('test.today')::date, '11111111-1111-4111-8111-111111111111'
  ) -> 0 -> 'tasks' -> 1 ->> 'date',
  current_setting('test.today'),
  'Undated draft is saved on today'
);
SELECT throws_ok(
  format($$SELECT public.create_spoon_task(%L, %L, '11111111-1111-4111-8111-111111111111')$$,
    jsonb_build_object('operationId', 'c-after-midnight', 'date', current_setting('test.yesterday'),
                       'expectedRevision', 5,
                       'draft', jsonb_build_object('name', 'Stretch', 'kind', 'recharge', 'amount', 1)),
    current_setting('test.today')),
  'SP409', 'The target day changed. Reload it and try again.', 'Undated draft from a stale day is rejected'
);

SELECT * FROM finish();
ROLLBACK;
