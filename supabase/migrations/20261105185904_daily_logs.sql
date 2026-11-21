CREATE TABLE public.daily_logs(
    date DATE NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    
    PRIMARY KEY(user_id, date),

    mood VARCHAR(20),
    flow VARCHAR(20),
    physical_symptoms TEXT[],
    emotional_symptoms TEXT[],
    reflection TEXT
);


-- adding constraints to match the types for DailyLog
ALTER TABlE public.daily_logs
ADD CONSTRAINT mood_types
CHECK (
    mood = 'verySad' OR
    mood = 'sad' OR
    mood = 'neutral' OR
    mood = 'happy' OR
    mood = 'veryHappy'
);

ALTER TABlE public.daily_logs
ADD CONSTRAINT flow_types
CHECK (
    flow = 'none' OR
    flow = 'veryLight' OR
    flow = 'light' OR
    flow = 'normal' OR
    flow = 'heavy' OR
    flow = 'veryHeavy'
);

ALTER TABLE public.daily_logs
ADD CONSTRAINT physical_symptom_types
CHECK (
    physical_symptoms <@ ARRAY[
        'headache',
        'menstrualCramps',
        'backPain',
        'migraines',
        'stomachPain'
    ]::TEXT[]
    AND array_position(physical_symptoms, NULL) IS NULL
);

ALTER TABLE public.daily_logs
ADD CONSTRAINT emotional_symptom_types
CHECK (
    emotional_symptoms <@ ARRAY[
        'moodSwings',
        'difficultyConcentrating',
        'anxiety',
        'fatigue',
        'lowMotivation'
    ]::TEXT[]
    AND array_position(emotional_symptoms, NULL) IS NULL
);

-- adding policies for RLS
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own daily logs"
ON public.daily_logs
FOR SELECT
TO authenticated
USING (
    user_id = (SELECT auth.uid())
);

CREATE POLICY "Users can insert own daily logs"
ON public.daily_logs
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
);

CREATE POLICY "Users can update own daily logs"
ON public.daily_logs
FOR UPDATE
TO authenticated
USING (
    user_id = (SELECT auth.uid())
)
WITH CHECK (
    user_id = (SELECT auth.uid())
);

CREATE POLICY "Users can delete own daily logs"
ON public.daily_logs
FOR DELETE
TO authenticated
USING (
    user_id = (SELECT auth.uid())
);