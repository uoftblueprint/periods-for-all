-- SpoonStore operations (contract in apps/mobile/src/features/spoons/contracts.ts).
--
-- Each public function is one transaction and mirrors the sample store's rules:
-- * Mutations take the contract's input object as p_input and return the
--   affected day snapshots (source first) as a JSON array.
-- * An operationId already used with an identical request returns current
--   snapshots of its original days without applying anything again. The same ID
--   with a different request is a conflict.
-- * expectedRevision must match the day's revision. Each changed day advances by
--   one; a no-op keeps its revision.
-- * Balances stay within 0–5 and effects record the change that actually fit.
--
-- The functions are SECURITY DEFINER because clients may not write the tables
-- directly. Every statement is scoped to auth.uid(); helpers live in the
-- unexposed spoons_private schema.
--
-- Errors use custom SQLSTATEs that the app maps to SpoonStoreError codes:
--   SP400 validation, SP404 missing-task, SP409 conflict, SP428 unanswered-energy.
-- 42501 means signed out or a different user.

------------------------------------------------------------------------------
-- Private helpers
------------------------------------------------------------------------------

CREATE FUNCTION spoons_private.fail(p_code TEXT, p_message TEXT)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION USING ERRCODE = p_code, MESSAGE = p_message;
END;
$$;

CREATE FUNCTION spoons_private.require_user(p_expected_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
    v_user UUID := (SELECT auth.uid());
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;
    IF p_expected_user_id IS DISTINCT FROM v_user THEN
        RAISE EXCEPTION 'user mismatch: call was made for a different user'
            USING ERRCODE = '42501';
    END IF;
    RETURN v_user;
END;
$$;

-- Parses a JSON 'YYYY-MM-DD' string.
CREATE FUNCTION spoons_private.to_date(p_value JSONB)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
    IF jsonb_typeof(p_value) IS DISTINCT FROM 'string'
        OR (p_value #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    THEN
        PERFORM spoons_private.fail('SP400', 'Choose a valid calendar day.');
    END IF;
    BEGIN
        RETURN (p_value #>> '{}')::DATE;
    EXCEPTION WHEN OTHERS THEN
        PERFORM spoons_private.fail('SP400', 'Choose a valid calendar day.');
    END;
END;
$$;

-- Whole number 0–5 (validateSpoonAmount).
CREATE FUNCTION spoons_private.to_amount(p_value JSONB)
RETURNS SMALLINT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
    IF jsonb_typeof(p_value) IS DISTINCT FROM 'number'
        OR (p_value #>> '{}')::NUMERIC NOT IN (0, 1, 2, 3, 4, 5)
    THEN
        PERFORM spoons_private.fail('SP400', 'Choose a whole number between 0 and 5.');
    END IF;
    RETURN (p_value #>> '{}')::NUMERIC::SMALLINT;
END;
$$;

-- The device's local "today" may be one day either side of UTC's.
CREATE FUNCTION spoons_private.check_today(p_today DATE)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
    v_utc_today DATE := (now() AT TIME ZONE 'utc')::DATE;
BEGIN
    IF p_today IS NULL OR p_today NOT BETWEEN v_utc_today - 1 AND v_utc_today + 1 THEN
        PERFORM spoons_private.fail('SP400', 'Check that this device''s date is correct.');
    END IF;
END;
$$;

CREATE FUNCTION spoons_private.effect_json(e public.spoon_effects)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'taskId', e.task_id::TEXT,
        'kind', e.kind,
        'requestedAmount', e.requested_amount,
        'appliedChange', e.applied_change,
        'at', to_char(e.at AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
$$;

-- Optional fields are omitted when empty, matching the TypeScript types.
CREATE FUNCTION spoons_private.task_json(t public.spoon_tasks)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'id', t.id::TEXT,
        'date', to_char(t.date, 'YYYY-MM-DD'),
        'name', t.name,
        'kind', t.kind,
        'amount', t.amount,
        'completion', (
            SELECT spoons_private.effect_json(e)
            FROM public.spoon_effects e
            WHERE e.id = t.completion_effect_id
        )
    ) || jsonb_strip_nulls(jsonb_build_object(
        'time', t.time,
        'priority', t.priority,
        'notes', t.notes,
        'subtasks', t.subtasks
    ));
$$;

CREATE FUNCTION spoons_private.day_json(p_user UUID, p_date DATE)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'date', to_char(p_date, 'YYYY-MM-DD'),
        'startingEnergy', d.starting_energy,
        'balance', d.balance,
        'revision', COALESCE(d.revision, 0),
        'tasks', COALESCE((
            SELECT jsonb_agg(spoons_private.task_json(t) ORDER BY t.position)
            FROM public.spoon_tasks t
            WHERE t.user_id = p_user AND t.date = p_date
        ), '[]'::JSONB),
        'effects', COALESCE((
            SELECT jsonb_agg(spoons_private.effect_json(e) ORDER BY e.id)
            FROM public.spoon_effects e
            WHERE e.user_id = p_user AND e.date = p_date
        ), '[]'::JSONB)
    )
    FROM (SELECT 1) AS one
    LEFT JOIN public.spoon_days d ON d.user_id = p_user AND d.date = p_date;
$$;

CREATE FUNCTION spoons_private.days_json(p_user UUID, p_dates DATE[])
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(jsonb_agg(spoons_private.day_json(p_user, d.date) ORDER BY d.ord), '[]'::JSONB)
    FROM unnest(p_dates) WITH ORDINALITY AS d(date, ord);
$$;

-- Starts a mutation. Returns the original dates if this exact request already
-- succeeded, otherwise NULL. Holds a lock so concurrent retries of one
-- operation ID run one after the other.
CREATE FUNCTION spoons_private.begin_operation(p_user UUID, p_method TEXT, p_input JSONB)
RETURNS DATE[]
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_operation_id TEXT;
    v_previous public.spoon_operations;
BEGIN
    IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN
        PERFORM spoons_private.fail('SP400', 'The request is missing its details.');
    END IF;
    v_operation_id := p_input ->> 'operationId';
    IF jsonb_typeof(p_input -> 'operationId') IS DISTINCT FROM 'string'
        OR btrim(v_operation_id) = ''
        OR char_length(v_operation_id) > 100
    THEN
        PERFORM spoons_private.fail('SP400', 'An operation ID is required.');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_user::TEXT || ':' || v_operation_id, 0));

    SELECT * INTO v_previous
    FROM public.spoon_operations
    WHERE user_id = p_user AND operation_id = v_operation_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    IF v_previous.method <> p_method OR v_previous.request <> p_input THEN
        PERFORM spoons_private.fail('SP409', 'This operation ID has already been used for another request.');
    END IF;
    RETURN v_previous.dates;
END;
$$;

CREATE FUNCTION spoons_private.finish_operation(
    p_user UUID, p_method TEXT, p_input JSONB, p_dates DATE[]
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.spoon_operations (user_id, operation_id, method, request, dates)
    VALUES (p_user, p_input ->> 'operationId', p_method, p_input, p_dates);
    RETURN spoons_private.days_json(p_user, p_dates);
END;
$$;

-- Creates the day row if needed and locks it for the rest of the transaction.
-- Lock two days in date order to avoid deadlocks.
CREATE FUNCTION spoons_private.lock_day(p_user UUID, p_date DATE)
RETURNS public.spoon_days
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_day public.spoon_days;
BEGIN
    INSERT INTO public.spoon_days (user_id, date)
    VALUES (p_user, p_date)
    ON CONFLICT (user_id, date) DO NOTHING;

    SELECT * INTO v_day
    FROM public.spoon_days
    WHERE user_id = p_user AND date = p_date
    FOR UPDATE;
    RETURN v_day;
END;
$$;

CREATE FUNCTION spoons_private.check_revision(p_day public.spoon_days, p_expected JSONB)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
    IF jsonb_typeof(p_expected) IS DISTINCT FROM 'number'
        OR (p_expected #>> '{}')::NUMERIC <> p_day.revision
    THEN
        PERFORM spoons_private.fail('SP409', 'This day changed. Reload it and try again.');
    END IF;
END;
$$;

CREATE FUNCTION spoons_private.bump(p_user UUID, p_date DATE)
RETURNS VOID
LANGUAGE sql
SET search_path = ''
AS $$
    UPDATE public.spoon_days SET revision = revision + 1
    WHERE user_id = p_user AND date = p_date;
$$;

-- Locks and returns a task on the given day, or fails with missing-task.
CREATE FUNCTION spoons_private.find_task(p_user UUID, p_date DATE, p_task_id JSONB)
RETURNS public.spoon_tasks
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_task public.spoon_tasks;
BEGIN
    IF jsonb_typeof(p_task_id) = 'string'
        AND (p_task_id #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN
        SELECT * INTO v_task
        FROM public.spoon_tasks
        WHERE user_id = p_user AND date = p_date AND id = (p_task_id #>> '{}')::UUID
        FOR UPDATE;
    END IF;
    IF v_task.id IS NULL THEN
        PERFORM spoons_private.fail('SP404', 'This task no longer exists on the selected day.');
    END IF;
    RETURN v_task;
END;
$$;

CREATE FUNCTION spoons_private.task_for_edit(p_user UUID, p_date DATE, p_task_id JSONB)
RETURNS public.spoon_tasks
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_task public.spoon_tasks := spoons_private.find_task(p_user, p_date, p_task_id);
BEGIN
    IF v_task.completion_effect_id IS NOT NULL THEN
        PERFORM spoons_private.fail('SP400', 'Undo completion before editing or moving this task.');
    END IF;
    RETURN v_task;
END;
$$;

-- Validates a SpoonTaskDraft (same rules and messages as the sample store).
CREATE FUNCTION spoons_private.validate_draft(p_draft JSONB)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
    IF jsonb_typeof(p_draft) IS DISTINCT FROM 'object' THEN
        PERFORM spoons_private.fail('SP400', 'The task is missing its details.');
    END IF;
    PERFORM spoons_private.to_amount(p_draft -> 'amount');
    IF jsonb_typeof(p_draft -> 'name') IS DISTINCT FROM 'string'
        OR (p_draft ->> 'name') ~ '^\s*$'
    THEN
        PERFORM spoons_private.fail('SP400', 'Enter a task name.');
    END IF;
    IF char_length(p_draft ->> 'name') > 200 THEN
        PERFORM spoons_private.fail('SP400', 'Use a task name of 200 characters or fewer.');
    END IF;
    IF (p_draft ->> 'kind') IS DISTINCT FROM 'spend' AND (p_draft ->> 'kind') IS DISTINCT FROM 'recharge'
        OR jsonb_typeof(p_draft -> 'kind') IS DISTINCT FROM 'string'
    THEN
        PERFORM spoons_private.fail('SP400', 'Choose spend or recharge.');
    END IF;
    IF p_draft ? 'time' AND (
        jsonb_typeof(p_draft -> 'time') IS DISTINCT FROM 'string'
        OR (p_draft ->> 'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    ) THEN
        PERFORM spoons_private.fail('SP400', 'Choose a valid local time.');
    END IF;
    IF p_draft ? 'priority' AND (
        jsonb_typeof(p_draft -> 'priority') IS DISTINCT FROM 'string'
        OR (p_draft ->> 'priority') NOT IN ('low', 'medium', 'high')
    ) THEN
        PERFORM spoons_private.fail('SP400', 'Choose a valid priority.');
    END IF;
    IF p_draft ? 'notes' AND jsonb_typeof(p_draft -> 'notes') IS DISTINCT FROM 'string' THEN
        PERFORM spoons_private.fail('SP400', 'Enter notes as text.');
    END IF;
    IF char_length(p_draft ->> 'notes') > 5000 THEN
        PERFORM spoons_private.fail('SP400', 'Use notes of 5000 characters or fewer.');
    END IF;
    IF p_draft ? 'subtasks' AND jsonb_typeof(p_draft -> 'subtasks') IS DISTINCT FROM 'array' THEN
        PERFORM spoons_private.fail('SP400', 'Enter subtasks as a list.');
    END IF;
    IF p_draft ? 'subtasks' AND NOT spoons_private.subtasks_valid(p_draft -> 'subtasks') THEN
        PERFORM spoons_private.fail('SP400', 'Give every subtask a unique ID and valid details.');
    END IF;
END;
$$;

-- Keeps only id, name and done for each subtask.
CREATE FUNCTION spoons_private.clean_subtasks(p_subtasks JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE WHEN p_subtasks IS NULL THEN NULL ELSE COALESCE((
        SELECT jsonb_agg(
            jsonb_build_object('id', s.item -> 'id', 'name', s.item -> 'name', 'done', s.item -> 'done')
            ORDER BY s.ord
        )
        FROM jsonb_array_elements(p_subtasks) WITH ORDINALITY AS s(item, ord)
    ), '[]'::JSONB) END;
$$;

-- JavaScript String.prototype.trim equivalent for task names.
CREATE FUNCTION spoons_private.trim_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT regexp_replace(p_name, '^\s+|\s+$', '', 'g');
$$;

-- Records a completion or undo (recordEffect in the sample store).
CREATE FUNCTION spoons_private.record_effect(p_user UUID, p_kind TEXT, p_input JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_method TEXT := CASE p_kind WHEN 'complete' THEN 'completeTask' ELSE 'undoCompletion' END;
    v_dates DATE[] := spoons_private.begin_operation(p_user, v_method, p_input);
    v_date DATE;
    v_day public.spoon_days;
    v_task public.spoon_tasks;
    v_previous_change SMALLINT;
    v_change INTEGER;
    v_effect_id BIGINT;
BEGIN
    IF v_dates IS NOT NULL THEN
        RETURN spoons_private.days_json(p_user, v_dates);
    END IF;

    v_date := spoons_private.to_date(p_input -> 'date');
    v_day := spoons_private.lock_day(p_user, v_date);
    PERFORM spoons_private.check_revision(v_day, p_input -> 'expectedRevision');
    v_task := spoons_private.find_task(p_user, v_date, p_input -> 'taskId');

    -- Repeating a completion or undo is a no-op that keeps the revision.
    IF (p_kind = 'complete') = (v_task.completion_effect_id IS NOT NULL) THEN
        RETURN spoons_private.finish_operation(p_user, v_method, p_input, ARRAY[v_date]);
    END IF;
    IF v_day.balance IS NULL THEN
        PERFORM spoons_private.fail('SP428', 'Set starting energy before completing a task.');
    END IF;

    IF p_kind = 'complete' THEN
        v_change := CASE v_task.kind WHEN 'spend' THEN -v_task.amount ELSE v_task.amount END;
    ELSE
        SELECT applied_change INTO v_previous_change
        FROM public.spoon_effects WHERE id = v_task.completion_effect_id;
        v_change := -v_previous_change;
    END IF;
    -- Only the part that fits inside 0–5 is applied (getAppliedChange).
    v_change := LEAST(5, GREATEST(0, v_day.balance + v_change)) - v_day.balance;

    INSERT INTO public.spoon_effects (user_id, date, task_id, kind, requested_amount, applied_change)
    VALUES (p_user, v_date, v_task.id, p_kind, v_task.amount, v_change)
    RETURNING id INTO v_effect_id;

    UPDATE public.spoon_tasks
    SET completion_effect_id = CASE WHEN p_kind = 'complete' THEN v_effect_id END
    WHERE id = v_task.id;

    UPDATE public.spoon_days
    SET balance = balance + v_change, revision = revision + 1
    WHERE user_id = p_user AND date = v_date;

    RETURN spoons_private.finish_operation(p_user, v_method, p_input, ARRAY[v_date]);
END;
$$;

------------------------------------------------------------------------------
-- Public API (called with supabase.rpc)
------------------------------------------------------------------------------

CREATE FUNCTION public.get_spoon_day(p_date DATE, p_expected_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user UUID := spoons_private.require_user(p_expected_user_id);
BEGIN
    IF p_date IS NULL THEN
        PERFORM spoons_private.fail('SP400', 'Choose a valid calendar day.');
    END IF;
    RETURN spoons_private.day_json(v_user, p_date);
END;
$$;

-- Unfinished tasks before p_today, newest day first.
CREATE FUNCTION public.list_unfinished_previous_spoon_tasks(p_today DATE, p_expected_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user UUID := spoons_private.require_user(p_expected_user_id);
BEGIN
    IF p_today IS NULL THEN
        PERFORM spoons_private.fail('SP400', 'Choose a valid calendar day.');
    END IF;
    RETURN COALESCE((
        SELECT jsonb_agg(spoons_private.task_json(t) ORDER BY t.date DESC, t.position)
        FROM public.spoon_tasks t
        WHERE t.user_id = v_user AND t.date < p_today AND t.completion_effect_id IS NULL
    ), '[]'::JSONB);
END;
$$;

-- Replaces the starting amount and keeps the day's recorded effects.
CREATE FUNCTION public.set_spoon_starting_energy(p_input JSONB, p_expected_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user UUID := spoons_private.require_user(p_expected_user_id);
    v_dates DATE[] := spoons_private.begin_operation(v_user, 'setStartingEnergy', p_input);
    v_date DATE;
    v_day public.spoon_days;
    v_amount SMALLINT;
    v_net INTEGER;
BEGIN
    IF v_dates IS NOT NULL THEN
        RETURN spoons_private.days_json(v_user, v_dates);
    END IF;

    v_date := spoons_private.to_date(p_input -> 'date');
    v_day := spoons_private.lock_day(v_user, v_date);
    PERFORM spoons_private.check_revision(v_day, p_input -> 'expectedRevision');
    v_amount := spoons_private.to_amount(p_input -> 'amount');

    IF v_day.starting_energy IS DISTINCT FROM v_amount THEN
        SELECT COALESCE(sum(applied_change), 0) INTO v_net
        FROM public.spoon_effects WHERE user_id = v_user AND date = v_date;

        UPDATE public.spoon_days
        SET starting_energy = v_amount,
            balance = LEAST(5, GREATEST(0, v_amount + v_net)),
            revision = revision + 1
        WHERE user_id = v_user AND date = v_date;
    END IF;

    RETURN spoons_private.finish_operation(v_user, 'setStartingEnergy', p_input, ARRAY[v_date]);
END;
$$;

-- p_today is the device's local date, used when the draft has no date.
CREATE FUNCTION public.create_spoon_task(p_input JSONB, p_today DATE, p_expected_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user UUID := spoons_private.require_user(p_expected_user_id);
    v_dates DATE[] := spoons_private.begin_operation(v_user, 'createTask', p_input);
    v_draft JSONB := p_input -> 'draft';
    v_target JSONB;
    v_date DATE;
    v_day public.spoon_days;
BEGIN
    IF v_dates IS NOT NULL THEN
        RETURN spoons_private.days_json(v_user, v_dates);
    END IF;
    IF jsonb_typeof(v_draft) IS DISTINCT FROM 'object' THEN
        PERFORM spoons_private.fail('SP400', 'The task is missing its details.');
    END IF;

    IF v_draft ? 'date' THEN
        v_target := v_draft -> 'date';
    ELSE
        PERFORM spoons_private.check_today(p_today);
        v_target := to_jsonb(to_char(p_today, 'YYYY-MM-DD'));
    END IF;
    IF v_target IS DISTINCT FROM p_input -> 'date' THEN
        PERFORM spoons_private.to_date(v_target);
        PERFORM spoons_private.fail('SP409', 'The target day changed. Reload it and try again.');
    END IF;

    v_date := spoons_private.to_date(p_input -> 'date');
    v_day := spoons_private.lock_day(v_user, v_date);
    PERFORM spoons_private.check_revision(v_day, p_input -> 'expectedRevision');
    PERFORM spoons_private.validate_draft(v_draft);

    INSERT INTO public.spoon_tasks
        (user_id, date, position, name, kind, amount, time, priority, notes, subtasks)
    VALUES (
        v_user, v_date, nextval('spoons_private.task_position'),
        spoons_private.trim_name(v_draft ->> 'name'),
        v_draft ->> 'kind',
        spoons_private.to_amount(v_draft -> 'amount'),
        v_draft ->> 'time',
        v_draft ->> 'priority',
        v_draft ->> 'notes',
        spoons_private.clean_subtasks(v_draft -> 'subtasks')
    );
    PERFORM spoons_private.bump(v_user, v_date);

    RETURN spoons_private.finish_operation(v_user, 'createTask', p_input, ARRAY[v_date]);
END;
$$;

-- Replaces an unfinished task with a full draft, optionally moving it to draft.date.
CREATE FUNCTION public.update_spoon_task(p_input JSONB, p_expected_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user UUID := spoons_private.require_user(p_expected_user_id);
    v_dates DATE[] := spoons_private.begin_operation(v_user, 'updateTask', p_input);
    v_draft JSONB := p_input -> 'draft';
    v_date DATE;
    v_destination DATE;
    v_day public.spoon_days;
    v_destination_day public.spoon_days;
    v_task public.spoon_tasks;
BEGIN
    IF v_dates IS NOT NULL THEN
        RETURN spoons_private.days_json(v_user, v_dates);
    END IF;

    v_date := spoons_private.to_date(p_input -> 'date');
    IF jsonb_typeof(v_draft) = 'object' AND v_draft ? 'date' THEN
        v_destination := spoons_private.to_date(v_draft -> 'date');
    ELSE
        v_destination := v_date;
    END IF;

    -- Lock both days in date order before checking either.
    IF v_destination < v_date THEN
        v_destination_day := spoons_private.lock_day(v_user, v_destination);
    END IF;
    v_day := spoons_private.lock_day(v_user, v_date);
    IF v_destination > v_date THEN
        v_destination_day := spoons_private.lock_day(v_user, v_destination);
    END IF;

    PERFORM spoons_private.check_revision(v_day, p_input -> 'expectedRevision');
    v_task := spoons_private.task_for_edit(v_user, v_date, p_input -> 'taskId');
    PERFORM spoons_private.validate_draft(v_draft);
    IF v_destination <> v_date THEN
        PERFORM spoons_private.check_revision(v_destination_day, p_input -> 'expectedDestinationRevision');
    END IF;

    UPDATE public.spoon_tasks
    SET date = v_destination,
        position = CASE WHEN v_destination = v_date THEN position
                        ELSE nextval('spoons_private.task_position') END,
        name = spoons_private.trim_name(v_draft ->> 'name'),
        kind = v_draft ->> 'kind',
        amount = spoons_private.to_amount(v_draft -> 'amount'),
        time = v_draft ->> 'time',
        priority = v_draft ->> 'priority',
        notes = v_draft ->> 'notes',
        subtasks = spoons_private.clean_subtasks(v_draft -> 'subtasks')
    WHERE id = v_task.id;

    PERFORM spoons_private.bump(v_user, v_date);
    IF v_destination = v_date THEN
        RETURN spoons_private.finish_operation(v_user, 'updateTask', p_input, ARRAY[v_date]);
    END IF;
    PERFORM spoons_private.bump(v_user, v_destination);
    RETURN spoons_private.finish_operation(v_user, 'updateTask', p_input, ARRAY[v_date, v_destination]);
END;
$$;

-- Deletes an unfinished task. A completed task must be undone first.
CREATE FUNCTION public.delete_spoon_task(p_input JSONB, p_expected_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user UUID := spoons_private.require_user(p_expected_user_id);
    v_dates DATE[] := spoons_private.begin_operation(v_user, 'deleteTask', p_input);
    v_date DATE;
    v_day public.spoon_days;
    v_task public.spoon_tasks;
BEGIN
    IF v_dates IS NOT NULL THEN
        RETURN spoons_private.days_json(v_user, v_dates);
    END IF;

    v_date := spoons_private.to_date(p_input -> 'date');
    v_day := spoons_private.lock_day(v_user, v_date);
    PERFORM spoons_private.check_revision(v_day, p_input -> 'expectedRevision');
    v_task := spoons_private.task_for_edit(v_user, v_date, p_input -> 'taskId');

    DELETE FROM public.spoon_tasks WHERE id = v_task.id;
    PERFORM spoons_private.bump(v_user, v_date);

    RETURN spoons_private.finish_operation(v_user, 'deleteTask', p_input, ARRAY[v_date]);
END;
$$;

CREATE FUNCTION public.complete_spoon_task(p_input JSONB, p_expected_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN spoons_private.record_effect(
        spoons_private.require_user(p_expected_user_id), 'complete', p_input
    );
END;
$$;

CREATE FUNCTION public.undo_spoon_completion(p_input JSONB, p_expected_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN spoons_private.record_effect(
        spoons_private.require_user(p_expected_user_id), 'undo', p_input
    );
END;
$$;

-- Moves the same unfinished task from an earlier day to p_today (the device's
-- local date). Energy on both days is unchanged.
CREATE FUNCTION public.move_spoon_task_to_today(p_input JSONB, p_today DATE, p_expected_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user UUID := spoons_private.require_user(p_expected_user_id);
    v_dates DATE[] := spoons_private.begin_operation(v_user, 'moveTaskToToday', p_input);
    v_date DATE;
    v_day public.spoon_days;
    v_today_day public.spoon_days;
    v_task public.spoon_tasks;
BEGIN
    IF v_dates IS NOT NULL THEN
        RETURN spoons_private.days_json(v_user, v_dates);
    END IF;

    v_date := spoons_private.to_date(p_input -> 'date');
    PERFORM spoons_private.check_today(p_today);
    IF v_date >= p_today THEN
        PERFORM spoons_private.fail('SP400', 'Choose an unfinished task from an earlier day.');
    END IF;

    -- The source day is earlier, so this locks in date order.
    v_day := spoons_private.lock_day(v_user, v_date);
    v_today_day := spoons_private.lock_day(v_user, p_today);

    PERFORM spoons_private.check_revision(v_day, p_input -> 'expectedRevision');
    v_task := spoons_private.task_for_edit(v_user, v_date, p_input -> 'taskId');
    IF to_jsonb(to_char(p_today, 'YYYY-MM-DD')) IS DISTINCT FROM p_input -> 'destinationDate' THEN
        PERFORM spoons_private.to_date(p_input -> 'destinationDate');
        PERFORM spoons_private.fail('SP409', 'The target day changed. Reload it and try again.');
    END IF;
    PERFORM spoons_private.check_revision(v_today_day, p_input -> 'expectedDestinationRevision');

    UPDATE public.spoon_tasks
    SET date = p_today, position = nextval('spoons_private.task_position')
    WHERE id = v_task.id;

    PERFORM spoons_private.bump(v_user, v_date);
    PERFORM spoons_private.bump(v_user, p_today);
    RETURN spoons_private.finish_operation(v_user, 'moveTaskToToday', p_input, ARRAY[v_date, p_today]);
END;
$$;

------------------------------------------------------------------------------
-- Privileges: only signed-in users may call the public functions; nobody may
-- call the private helpers directly.
------------------------------------------------------------------------------

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA spoons_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE spoons_private.task_position FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
    public.get_spoon_day(DATE, UUID),
    public.list_unfinished_previous_spoon_tasks(DATE, UUID),
    public.set_spoon_starting_energy(JSONB, UUID),
    public.create_spoon_task(JSONB, DATE, UUID),
    public.update_spoon_task(JSONB, UUID),
    public.delete_spoon_task(JSONB, UUID),
    public.complete_spoon_task(JSONB, UUID),
    public.undo_spoon_completion(JSONB, UUID),
    public.move_spoon_task_to_today(JSONB, DATE, UUID)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
    public.get_spoon_day(DATE, UUID),
    public.list_unfinished_previous_spoon_tasks(DATE, UUID),
    public.set_spoon_starting_energy(JSONB, UUID),
    public.create_spoon_task(JSONB, DATE, UUID),
    public.update_spoon_task(JSONB, UUID),
    public.delete_spoon_task(JSONB, UUID),
    public.complete_spoon_task(JSONB, UUID),
    public.undo_spoon_completion(JSONB, UUID),
    public.move_spoon_task_to_today(JSONB, DATE, UUID)
TO authenticated;
