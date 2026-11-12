
CREATE FUNCTION public.update_period_days(
    p_add DATE[],
    p_remove DATE[],
    p_expected_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    current_user_id UUID := (SELECT auth.uid());
BEGIN
    if p_expected_user_id is distinct from auth.uid() then
      raise exception 'user mismatch: call was made for a different user'
        using errcode = '42501';
    end if;

    -- Require an authenticated user
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Reject missing arrays or null dates
    IF p_add IS NULL OR p_remove IS NULL
        OR array_position(p_add, NULL) IS NOT NULL
        OR array_position(p_remove, NULL) IS NOT NULL
    THEN
        RAISE EXCEPTION 'Invalid date arrays';
    END IF;

    -- A date cannot be added and removed simultaneously
    IF EXISTS (
        SELECT 1
        FROM unnest(p_add) AS a(day)
        JOIN unnest(p_remove) AS r(day)
        ON a.day = r.day
    ) THEN
        RAISE EXCEPTION 'Contradictory date changes';
    END IF;

    -- Reject future days, allowing one day past UTC for timezones ahead of it
    IF EXISTS (
        SELECT 1
        FROM unnest(p_add) AS a(day)
        WHERE a.day > current_date + 1
    ) THEN
        RAISE EXCEPTION 'Period days cannot be in the future';
    END IF;

    -- Add requested days, ignoring existing ones
    INSERT INTO public.period_days (user_id, date)
    SELECT DISTINCT current_user_id, a.day
    FROM unnest(p_add) AS a(day)
    ON CONFLICT (user_id, date) DO NOTHING;

    -- Remove only requested days
    DELETE FROM public.period_days
    WHERE user_id = current_user_id
        AND date = ANY(p_remove);
END;
$$;

-- Only authenticated users may call this function
REVOKE ALL ON FUNCTION public.update_period_days(DATE[], DATE[], UUID)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_period_days(DATE[], DATE[], UUID)
TO authenticated;
