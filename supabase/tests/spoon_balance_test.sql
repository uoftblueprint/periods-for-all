BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(29);

INSERT INTO auth.users (id, email)
VALUES ('11111111-1111-4111-8111-111111111111', 'spoon-balance@example.test');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

-- Test 1: an unseen day is unanswered at revision 0, and reading it saves nothing.
SELECT is(
  public.get_spoon_day('2026-11-10', '11111111-1111-4111-8111-111111111111'),
  '{"date": "2026-11-10", "startingEnergy": null, "balance": null, "revision": 0, "tasks": [], "effects": []}'::jsonb,
  'Unseen day is unanswered'
);
SELECT is_empty($$SELECT 1 FROM public.spoon_days$$, 'Opening a day does not create a record');

------------------------------------------------------------------------------
-- Spend capped at zero: 1 - 3 = 0 (applied -1); undo restores 1.
------------------------------------------------------------------------------
SELECT set_config('test.spend', public.create_spoon_task(
  '{"operationId": "c-spend", "date": "2026-11-10", "expectedRevision": 0,
    "draft": {"date": "2026-11-10", "name": "  Laundry  ", "kind": "spend", "amount": 3}}',
  NULL, '11111111-1111-4111-8111-111111111111'
) -> 0 -> 'tasks' -> 0 ->> 'id', true);

SELECT is(
  public.get_spoon_day('2026-11-10', '11111111-1111-4111-8111-111111111111') -> 'tasks' -> 0,
  jsonb_build_object('id', current_setting('test.spend'), 'date', '2026-11-10', 'name', 'Laundry',
                     'kind', 'spend', 'amount', 3, 'completion', NULL),
  'Task name is trimmed and empty optional fields are omitted'
);

SELECT throws_ok(
  format($$SELECT public.complete_spoon_task(
      '{"operationId": "k-early", "date": "2026-11-10", "expectedRevision": 1, "taskId": %s}',
      '11111111-1111-4111-8111-111111111111')$$, to_jsonb(current_setting('test.spend'))),
  'SP428', NULL, 'Completing before answering energy asks for energy'
);

SELECT is(
  public.set_spoon_starting_energy(
    '{"operationId": "e-zero", "date": "2026-11-10", "expectedRevision": 1, "amount": 0}',
    '11111111-1111-4111-8111-111111111111'
  ) -> 0 -> 'balance',
  '0'::jsonb,
  'Explicit zero is saved as zero, not unanswered'
);

SELECT is(
  public.set_spoon_starting_energy(
    '{"operationId": "e-one", "date": "2026-11-10", "expectedRevision": 2, "amount": 1}',
    '11111111-1111-4111-8111-111111111111'
  ) -> 0 -> 'balance',
  '1'::jsonb,
  'Starting energy can be changed'
);

SELECT set_config('test.day', public.complete_spoon_task(
  jsonb_build_object('operationId', 'k-spend', 'date', '2026-11-10', 'expectedRevision', 3,
                     'taskId', current_setting('test.spend')),
  '11111111-1111-4111-8111-111111111111'
) ->> 0, true);

SELECT is(current_setting('test.day')::jsonb -> 'balance', '0'::jsonb, 'Spend 3 at balance 1 stops at 0');
SELECT is(
  current_setting('test.day')::jsonb -> 'tasks' -> 0 -> 'completion' -> 'appliedChange', '-1'::jsonb,
  'Completion records the applied change (-1)'
);
SELECT is(
  current_setting('test.day')::jsonb -> 'tasks' -> 0 -> 'completion' -> 'requestedAmount', '3'::jsonb,
  'Completion keeps the requested amount (3)'
);

-- Changing starting energy keeps completed effects: 4 + (-1) = 3.
SELECT is(
  public.set_spoon_starting_energy(
    '{"operationId": "e-four", "date": "2026-11-10", "expectedRevision": 4, "amount": 4}',
    '11111111-1111-4111-8111-111111111111'
  ) -> 0 -> 'balance',
  '3'::jsonb,
  'New starting energy keeps completed effects'
);
SELECT is(
  public.set_spoon_starting_energy(
    '{"operationId": "e-one-again", "date": "2026-11-10", "expectedRevision": 5, "amount": 1}',
    '11111111-1111-4111-8111-111111111111'
  ) -> 0 -> 'balance',
  '0'::jsonb,
  'Back to starting energy 1'
);

-- A completed task must be undone before it is edited or deleted.
SELECT throws_ok(
  format($$SELECT public.update_spoon_task(
      '{"operationId": "edit-done", "date": "2026-11-10", "expectedRevision": 6, "taskId": %s,
        "draft": {"name": "Laundry", "kind": "spend", "amount": 1}}',
      '11111111-1111-4111-8111-111111111111')$$, to_jsonb(current_setting('test.spend'))),
  'SP400', 'Undo completion before editing or moving this task.', 'Completed task cannot be edited'
);
SELECT throws_ok(
  format($$SELECT public.delete_spoon_task(
      '{"operationId": "delete-done", "date": "2026-11-10", "expectedRevision": 6, "taskId": %s}',
      '11111111-1111-4111-8111-111111111111')$$, to_jsonb(current_setting('test.spend'))),
  'SP400', 'Undo completion before editing or moving this task.', 'Completed task cannot be deleted'
);

SELECT set_config('test.day', public.undo_spoon_completion(
  jsonb_build_object('operationId', 'u-spend', 'date', '2026-11-10', 'expectedRevision', 6,
                     'taskId', current_setting('test.spend')),
  '11111111-1111-4111-8111-111111111111'
) ->> 0, true);

SELECT is(current_setting('test.day')::jsonb -> 'balance', '1'::jsonb, 'Undo restores 1, not 4');
SELECT is(
  current_setting('test.day')::jsonb -> 'effects' -> 1 -> 'appliedChange', '1'::jsonb,
  'Undo records its own applied change (+1)'
);

-- Undoing again is a no-op that keeps the revision.
SELECT set_config('test.day', public.undo_spoon_completion(
  jsonb_build_object('operationId', 'u-spend-again', 'date', '2026-11-10', 'expectedRevision', 7,
                     'taskId', current_setting('test.spend')),
  '11111111-1111-4111-8111-111111111111'
) ->> 0, true);
SELECT is(
  ARRAY[current_setting('test.day')::jsonb -> 'revision', current_setting('test.day')::jsonb -> 'balance',
        to_jsonb(jsonb_array_length(current_setting('test.day')::jsonb -> 'effects'))],
  ARRAY['7'::jsonb, '1'::jsonb, '2'::jsonb],
  'Repeated undo changes nothing'
);

------------------------------------------------------------------------------
-- Recharge capped at five: 4 + 3 = 5 (applied +1); undo restores 4.
------------------------------------------------------------------------------
SELECT public.set_spoon_starting_energy(
  '{"operationId": "e-recharge", "date": "2026-11-11", "expectedRevision": 0, "amount": 4}',
  '11111111-1111-4111-8111-111111111111'
);
SELECT set_config('test.recharge', public.create_spoon_task(
  '{"operationId": "c-recharge", "date": "2026-11-11", "expectedRevision": 1,
    "draft": {"date": "2026-11-11", "name": "Nap", "kind": "recharge", "amount": 3}}',
  NULL, '11111111-1111-4111-8111-111111111111'
) -> 0 -> 'tasks' -> 0 ->> 'id', true);

SELECT is(
  public.complete_spoon_task(
    jsonb_build_object('operationId', 'k-recharge', 'date', '2026-11-11', 'expectedRevision', 2,
                       'taskId', current_setting('test.recharge')),
    '11111111-1111-4111-8111-111111111111'
  ) -> 0 -> 'balance',
  '5'::jsonb,
  'Recharge 3 at balance 4 stops at 5'
);
SELECT is(
  public.undo_spoon_completion(
    jsonb_build_object('operationId', 'u-recharge', 'date', '2026-11-11', 'expectedRevision', 3,
                       'taskId', current_setting('test.recharge')),
    '11111111-1111-4111-8111-111111111111'
  ) -> 0 -> 'balance',
  '4'::jsonb,
  'Undo of the capped recharge restores 4'
);

------------------------------------------------------------------------------
-- Undo is bounded again after intervening activity.
-- Start 2; spend 2 -> 0; recharge 5 -> 5; undo the spend wants +2 but adds 0.
------------------------------------------------------------------------------
SELECT public.set_spoon_starting_energy(
  '{"operationId": "e-bound", "date": "2026-11-12", "expectedRevision": 0, "amount": 2}',
  '11111111-1111-4111-8111-111111111111'
);
SELECT set_config('test.spend2', public.create_spoon_task(
  '{"operationId": "c-spend2", "date": "2026-11-12", "expectedRevision": 1,
    "draft": {"date": "2026-11-12", "name": "Groceries", "kind": "spend", "amount": 2}}',
  NULL, '11111111-1111-4111-8111-111111111111'
) -> 0 -> 'tasks' -> 0 ->> 'id', true);
SELECT set_config('test.recharge5', public.create_spoon_task(
  '{"operationId": "c-recharge5", "date": "2026-11-12", "expectedRevision": 2,
    "draft": {"date": "2026-11-12", "name": "Rest", "kind": "recharge", "amount": 5}}',
  NULL, '11111111-1111-4111-8111-111111111111'
) -> 0 -> 'tasks' -> 1 ->> 'id', true);
SELECT public.complete_spoon_task(
  jsonb_build_object('operationId', 'k-spend2', 'date', '2026-11-12', 'expectedRevision', 3,
                     'taskId', current_setting('test.spend2')),
  '11111111-1111-4111-8111-111111111111'
);
SELECT public.complete_spoon_task(
  jsonb_build_object('operationId', 'k-recharge5', 'date', '2026-11-12', 'expectedRevision', 4,
                     'taskId', current_setting('test.recharge5')),
  '11111111-1111-4111-8111-111111111111'
);
SELECT set_config('test.day', public.undo_spoon_completion(
  jsonb_build_object('operationId', 'u-spend2', 'date', '2026-11-12', 'expectedRevision', 5,
                     'taskId', current_setting('test.spend2')),
  '11111111-1111-4111-8111-111111111111'
) ->> 0, true);

SELECT is(current_setting('test.day')::jsonb -> 'balance', '5'::jsonb, 'Undo cannot raise the balance above 5');
SELECT is(
  current_setting('test.day')::jsonb -> 'effects' -> 2 -> 'appliedChange', '0'::jsonb,
  'Undo records the zero change that fit'
);

------------------------------------------------------------------------------
-- Validation (backend rejects what the client should already block).
------------------------------------------------------------------------------
SELECT throws_ok(
  $$SELECT public.set_spoon_starting_energy(
      '{"operationId": "e-six", "date": "2026-11-13", "expectedRevision": 0, "amount": 6}',
      '11111111-1111-4111-8111-111111111111')$$,
  'SP400', 'Choose a whole number between 0 and 5.', 'Energy above 5 is rejected'
);
SELECT throws_ok(
  $$SELECT public.set_spoon_starting_energy(
      '{"operationId": "e-half", "date": "2026-11-13", "expectedRevision": 0, "amount": 2.5}',
      '11111111-1111-4111-8111-111111111111')$$,
  'SP400', 'Choose a whole number between 0 and 5.', 'Fractional energy is rejected'
);
SELECT throws_ok(
  $$SELECT public.create_spoon_task(
      '{"operationId": "c-bad-amount", "date": "2026-11-13", "expectedRevision": 0,
        "draft": {"date": "2026-11-13", "name": "Walk", "kind": "spend", "amount": -1}}',
      NULL, '11111111-1111-4111-8111-111111111111')$$,
  'SP400', 'Choose a whole number between 0 and 5.', 'Negative task amount is rejected'
);
SELECT throws_ok(
  $$SELECT public.create_spoon_task(
      '{"operationId": "c-blank", "date": "2026-11-13", "expectedRevision": 0,
        "draft": {"date": "2026-11-13", "name": "   ", "kind": "spend", "amount": 1}}',
      NULL, '11111111-1111-4111-8111-111111111111')$$,
  'SP400', 'Enter a task name.', 'Blank task name is rejected'
);
SELECT throws_ok(
  $$SELECT public.create_spoon_task(
      '{"operationId": "c-time", "date": "2026-11-13", "expectedRevision": 0,
        "draft": {"date": "2026-11-13", "name": "Walk", "kind": "spend", "amount": 1, "time": "24:00"}}',
      NULL, '11111111-1111-4111-8111-111111111111')$$,
  'SP400', 'Choose a valid local time.', 'Invalid time is rejected'
);
SELECT throws_ok(
  $$SELECT public.create_spoon_task(
      '{"operationId": "c-subtasks", "date": "2026-11-13", "expectedRevision": 0,
        "draft": {"date": "2026-11-13", "name": "Walk", "kind": "spend", "amount": 1,
                  "subtasks": [{"id": "s1", "name": "Shoes", "done": false},
                               {"id": "s1", "name": "Keys", "done": false}]}}',
      NULL, '11111111-1111-4111-8111-111111111111')$$,
  'SP400', 'Give every subtask a unique ID and valid details.', 'Duplicate subtask IDs are rejected'
);
SELECT throws_ok(
  $$SELECT public.create_spoon_task(
      '{"operationId": "c-kind", "date": "2026-11-13", "expectedRevision": 0,
        "draft": {"date": "2026-11-13", "name": "Walk", "kind": "borrow", "amount": 1}}',
      NULL, '11111111-1111-4111-8111-111111111111')$$,
  'SP400', 'Choose spend or recharge.', 'Unknown kind is rejected'
);
SELECT throws_ok(
  $$SELECT public.get_spoon_day(NULL, '11111111-1111-4111-8111-111111111111')$$,
  'SP400', 'Choose a valid calendar day.', 'Missing date is rejected'
);

-- Test 29: optional fields round-trip, and subtasks keep only id/name/done.
SELECT is(
  (public.create_spoon_task(
    '{"operationId": "c-full", "date": "2026-11-13", "expectedRevision": 0,
      "draft": {"date": "2026-11-13", "name": "Walk", "kind": "spend", "amount": 2, "time": "08:30",
                "priority": "high", "notes": "Slowly",
                "subtasks": [{"id": "s1", "name": "Shoes", "done": true, "extra": 1}]}}',
    NULL, '11111111-1111-4111-8111-111111111111'
  ) -> 0 -> 'tasks' -> 0) - 'id',
  '{"date": "2026-11-13", "name": "Walk", "kind": "spend", "amount": 2, "time": "08:30",
    "priority": "high", "notes": "Slowly", "completion": null,
    "subtasks": [{"id": "s1", "name": "Shoes", "done": true}]}'::jsonb,
  'Optional task fields are saved and returned'
);

SELECT * FROM finish();
ROLLBACK;
