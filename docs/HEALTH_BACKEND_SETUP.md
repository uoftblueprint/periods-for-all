# Health backend setup (S3-02)

How to apply and check the Supabase tables behind `createSupabaseHealthStore`
(`apps/mobile/src/features/health/supabase-health-store.ts`). The store implements
the shared `HealthStore` contract in `apps/mobile/src/features/health/contracts.ts`;
see [SPRINT_3.md](SPRINT_3.md) for what the fields mean.

Run all commands from the repo root.

## What the migrations create

Apply them in timestamp order. The CLI does this for you.

| Migration | Adds |
| --- | --- |
| `20261105173020_period_days.sql` | `period_days (user_id, date)`, one row per period day, with RLS |
| `20261105185904_daily_logs.sql` | `daily_logs`: mood, flow, symptoms and reflection per day. Its CHECK constraints match `Mood`, `Flow` and the symptom catalog. RLS on |
| `20261105185923_period_setup.sql` | `period_setup`, one row per user. CHECKs: cycle 21–45, period 1–12, `step` values from `PeriodSetup`. RLS on |
| `20261108194723_atomic_period_day_updates.sql` | `update_period_days(p_add, p_remove, p_expected_user_id)` RPC: one all-or-nothing change. Rejects a user mismatch, null or contradictory dates, and future dates. Only `authenticated` can call it |
| `20261109120000_reject_future_dates.sql` | Triggers that reject dates later than `current_date + 1` on all three tables |

Every policy limits a row to `auth.uid() = user_id`. The `+ 1` allows for
time zones ahead of UTC and assumes the database clock is UTC.

> **Keep in sync:** if `Mood`, `Flow`, `PeriodSetup['step']` or the symptom ids in
> `catalog.ts` change, the CHECK constraints need a new migration. Otherwise
> saves will fail with `SAVE_LOG_ERROR` / `SAVE_SETUP_ERROR`.

## Local setup

Requires Docker Desktop (see the [README](../README.md#supabase-only-for-real-backend-work)).

```bash
npx supabase start            # first run downloads images
npx supabase migration list --local   # all five should show in both columns
```

If any are missing, apply them:

```bash
npx supabase migration up     # applies pending migrations, keeps existing data
# or, to rebuild from scratch (deletes local users and rows):
npx supabase db reset
```

Run the database tests (pgTAP). They create test users inside a transaction and
roll it back at the end, so they leave no data behind:

```bash
npx supabase test db
```

Expected: `Files=3, Tests=40 … Result: PASS`.

Run the store's unit tests (fake client, no backend needed):

```bash
npm run test:services --workspace mobile
```

To use the real store in the app, set `apps/mobile/.env.local` from
`apps/mobile/.env.example`, using the URL and publishable key printed by
`npx supabase status`.

## Hosted setup

Use a development or staging project, not one with real users' health data.
The project goes in Canada (`ca-central-1`).

1. **Link the project** (you'll be asked for the database password; type it
   yourself, don't paste it into chat or commit it):

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   ```

2. **Preview, then push** the migrations:

   ```bash
   npx supabase db push --dry-run   # should list exactly the five files above
   npx supabase db push
   npx supabase migration list      # Local and Remote columns should match
   ```

   If the dry run lists other migrations, or reports remote migrations that
   aren't in this repo, stop and sort that out first. Don't use `--include-all`
   or `migration repair` without agreeing it with the team.

3. **Run the pgTAP tests against the hosted database:**

   ```bash
   npx supabase test db --linked
   ```

   Each test file runs in a transaction that rolls back, so the synthetic
   `auth.users` rows and health rows are never committed.

4. **Check these in the dashboard / SQL editor:**

   - [ ] `SHOW timezone;` returns `UTC`. The future-date checks rely on it.
   - [ ] RLS is **enabled** on `period_days`, `daily_logs` and `period_setup`
         (Table Editor shows it, or run this; `rowsecurity` should be `true`
         for all three):

         ```sql
         SELECT tablename, rowsecurity
         FROM pg_tables
         WHERE schemaname = 'public'
           AND tablename IN ('period_days', 'daily_logs', 'period_setup');
         ```

   - [ ] Each of those tables has four policies (SELECT, INSERT, UPDATE,
         DELETE), all limited to the signed-in user:

         ```sql
         SELECT tablename, policyname, cmd
         FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename IN ('period_days', 'daily_logs', 'period_setup')
         ORDER BY tablename, cmd;
         ```
   - [ ] The Data API exposes the `public` schema, and `authenticated` can
         select/insert/update/delete on the three tables. The migrations don't
         `GRANT` table privileges; they rely on Supabase's default privileges.
         If the project has automatic exposure of new tables turned off, the app
         will get `permission denied` and a grant migration is needed.
   - [ ] Database → Functions shows `update_period_days`, and `anon` cannot
         execute it.

5. **Two-account check in the app** (optional, but it's the only end-to-end
   check). Point `.env.local` at the hosted URL and publishable key, sign in
   as account A, mark period days, save a daily log, and finish period setup.
   Then sign in as account B and confirm none of A's data appears. Delete both
   test accounts afterwards. Delete their health rows first: the foreign keys
   have no `ON DELETE`, so deleting a user who still has rows fails.

## Rolling back

There are no down migrations. To undo on a disposable project, drop the triggers,
`reject_future_date()`, `update_period_days(date[], date[], uuid)` and the three
tables, then run `npx supabase migration repair --status reverted <version>` for
each of the five versions. On a shared project, add a new migration instead.
