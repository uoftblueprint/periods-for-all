SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'period_days',
    'daily_logs',
    'period_setup'
);