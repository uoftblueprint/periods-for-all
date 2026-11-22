-- Daily spoon records, tasks and completion effects.
--
-- Users can read their own rows through RLS, but cannot write these tables
-- directly. Every write goes through the functions in the next migration, which
-- apply the 0–5 balance rules, revision checks and operation-ID retries in one
-- transaction. 

CREATE SCHEMA IF NOT EXISTS spoons_private;
REVOKE ALL ON SCHEMA spoons_private FROM PUBLIC, anon, authenticated;

-- One row per account and local calendar day. A day with no row is unanswered at
-- revision 0. Null starting energy means "not answered", which differs from 0.
CREATE TABLE public.spoon_days (
    user_id UUID NOT NULL REFERENCES auth.users(id),
    date DATE NOT NULL,
    starting_energy SMALLINT CHECK (starting_energy BETWEEN 0 AND 5),
    balance SMALLINT CHECK (balance BETWEEN 0 AND 5),
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),

    PRIMARY KEY (user_id, date),
    CONSTRAINT spoon_days_energy_answered
        CHECK ((starting_energy IS NULL) = (balance IS NULL))
);

-- Subtasks are stored as [{id, name, done}] with unique, non-blank IDs.
CREATE FUNCTION spoons_private.subtasks_valid(p_subtasks JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT p_subtasks IS NULL OR (
        jsonb_typeof(p_subtasks) = 'array'
        AND jsonb_array_length(p_subtasks) <= 50
        AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(p_subtasks) AS s(item)
            WHERE jsonb_typeof(s.item) IS DISTINCT FROM 'object'
                OR jsonb_typeof(s.item -> 'id') IS DISTINCT FROM 'string'
                OR btrim(s.item ->> 'id') = ''
                OR jsonb_typeof(s.item -> 'name') IS DISTINCT FROM 'string'
                OR char_length(s.item ->> 'name') > 200
                OR jsonb_typeof(s.item -> 'done') IS DISTINCT FROM 'boolean'
        )
        AND (
            SELECT count(DISTINCT s.item ->> 'id') = count(*)
            FROM jsonb_array_elements(p_subtasks) AS s(item)
        )
    );
$$;

-- Orders tasks within a day. A task moved to another day goes to the end.
CREATE SEQUENCE spoons_private.task_position;

CREATE TABLE public.spoon_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    position BIGINT NOT NULL,
    name TEXT NOT NULL CHECK (name <> '' AND char_length(name) <= 200),
    kind TEXT NOT NULL CHECK (kind IN ('spend', 'recharge')),
    amount SMALLINT NOT NULL CHECK (amount BETWEEN 0 AND 5),
    time TEXT CHECK (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
    notes TEXT CHECK (char_length(notes) <= 5000),
    subtasks JSONB CHECK (spoons_private.subtasks_valid(subtasks)),
    -- Set while the task is completed; points at its 'complete' effect.
    completion_effect_id BIGINT UNIQUE,

    FOREIGN KEY (user_id, date) REFERENCES public.spoon_days(user_id, date)
);

CREATE INDEX spoon_tasks_user_date ON public.spoon_tasks (user_id, date, position);

-- Activity history for a day. requested_amount is what the task asked for;
-- applied_change is the signed change that actually fit inside 0–5. task_id has
-- no foreign key: history stays after an undone task is deleted.
CREATE TABLE public.spoon_effects (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    task_id UUID NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('complete', 'undo')),
    requested_amount SMALLINT NOT NULL CHECK (requested_amount BETWEEN 0 AND 5),
    applied_change SMALLINT NOT NULL CHECK (applied_change BETWEEN -5 AND 5),
    at TIMESTAMPTZ NOT NULL DEFAULT now(),

    FOREIGN KEY (user_id, date) REFERENCES public.spoon_days(user_id, date)
);

CREATE INDEX spoon_effects_user_date ON public.spoon_effects (user_id, date, id);

ALTER TABLE public.spoon_tasks
ADD CONSTRAINT spoon_tasks_completion_effect
FOREIGN KEY (completion_effect_id) REFERENCES public.spoon_effects(id);

-- Completed operation IDs, so a retried request never applies twice.
-- request is the client's whole input; jsonb equality ignores key order.
CREATE TABLE public.spoon_operations (
    user_id UUID NOT NULL REFERENCES auth.users(id),
    operation_id TEXT NOT NULL
        CHECK (btrim(operation_id) <> '' AND char_length(operation_id) <= 100),
    method TEXT NOT NULL,
    request JSONB NOT NULL,
    dates DATE[] NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, operation_id)
);

-- Read-only access to your own rows; no direct writes.
ALTER TABLE public.spoon_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spoon_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spoon_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spoon_operations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.spoon_days, public.spoon_tasks, public.spoon_effects, public.spoon_operations
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.spoon_days, public.spoon_tasks, public.spoon_effects TO authenticated;

CREATE POLICY "Users can read own spoon days"
ON public.spoon_days FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can read own spoon tasks"
ON public.spoon_tasks FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can read own spoon effects"
ON public.spoon_effects FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

-- spoon_operations has no policies: only the write functions use it.
