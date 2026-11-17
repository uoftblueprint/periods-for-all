CREATE TABLE public.period_days(
    date DATE NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),

    PRIMARY KEY(user_id, date)
);

-- adding policies for RLS
ALTER TABLE public.period_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own period days"
ON public.period_days
FOR SELECT
TO authenticated
USING (
    user_id = (SELECT auth.uid())
);

CREATE POLICY "Users can insert own period days"
ON public.period_days
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
);

CREATE POLICY "Users can update own period days"
ON public.period_days
FOR UPDATE
TO authenticated
USING (
    user_id = (SELECT auth.uid())
)
WITH CHECK (
    user_id = (SELECT auth.uid())
);

CREATE POLICY "Users can delete own period days"
ON public.period_days
FOR DELETE
TO authenticated
USING (
    user_id = (SELECT auth.uid())
);