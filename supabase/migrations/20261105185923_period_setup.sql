CREATE TABLE public.period_setup(
    user_id UUID NOT NULL REFERENCES auth.users(id),
    PRIMARY KEY(user_id),

    last_period_start DATE,
    cycle_length INTEGER,
    period_length INTEGER,
    step VARCHAR(20) NOT NULL DEFAULT 'intro'
);


-- adding constraints to match the types for PeriodSetup
ALTER TABLE public.period_setup
ADD CONSTRAINT cycle_length_range
CHECK (
    cycle_length BETWEEN 21 AND 45
);

ALTER TABLE public.period_setup
ADD CONSTRAINT period_length_range
CHECK (
    period_length BETWEEN 1 AND 12
);

ALTER TABLE public.period_setup
ADD CONSTRAINT setup_step_types
CHECK (
    step = 'intro' OR
    step = 'lastPeriod' OR
    step = 'cycle' OR
    step = 'length' OR
    step = 'complete'
);


-- adding policies for RLS
ALTER TABLE public.period_setup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own period setup"
ON public.period_setup
FOR SELECT
TO authenticated
USING (
    user_id = (SELECT auth.uid())
);

CREATE POLICY "Users can insert own period setup"
ON public.period_setup
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
);

CREATE POLICY "Users can update own period setup"
ON public.period_setup
FOR UPDATE
TO authenticated
USING (
    user_id = (SELECT auth.uid())
)
WITH CHECK (
    user_id = (SELECT auth.uid())
);

CREATE POLICY "Users can delete own period setup"
ON public.period_setup
FOR DELETE
TO authenticated
USING (
    user_id = (SELECT auth.uid())
);