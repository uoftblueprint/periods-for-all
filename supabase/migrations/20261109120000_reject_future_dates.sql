-- Reject future dates however rows are written (direct table writes or functions).
-- TG_ARGV[0] names the date column. One day past UTC is allowed for timezones ahead of it.
CREATE FUNCTION public.reject_future_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF (to_jsonb(NEW) ->> TG_ARGV[0])::date > current_date + 1 THEN
        RAISE EXCEPTION 'Dates cannot be in the future';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER reject_future_date
BEFORE INSERT OR UPDATE ON public.period_days
FOR EACH ROW EXECUTE FUNCTION public.reject_future_date('date');

CREATE TRIGGER reject_future_date
BEFORE INSERT OR UPDATE ON public.daily_logs
FOR EACH ROW EXECUTE FUNCTION public.reject_future_date('date');

CREATE TRIGGER reject_future_date
BEFORE INSERT OR UPDATE ON public.period_setup
FOR EACH ROW EXECUTE FUNCTION public.reject_future_date('last_period_start');
