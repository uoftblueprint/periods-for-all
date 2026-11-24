# Spoon backend setup (S4-02)

How to apply and check the Supabase tables and functions behind
`createSupabaseSpoonStore` (`apps/mobile/src/features/spoons/supabase-spoon-store.ts`).
The store implements the shared `SpoonStore` contract in
`apps/mobile/src/features/spoons/contracts.ts`; see [SPRINT_4.md](SPRINT_4.md) for
what the fields and balance rules mean.

Run all commands from the repo root. Use development test data only.

## What the migrations create

| Migration | Adds |
| --- | --- |
| `20261122120000_spoon_tables.sql` | `spoon_days` (one row per account and local date: starting energy, balance, revision), `spoon_tasks`, `spoon_effects` (completion and undo history, with the requested amount and the change actually applied) and `spoon_operations` (finished operation IDs, so retries never apply twice). Also the private `spoons_private` schema. CHECKs keep every amount and balance within 0–5. RLS on all four tables |
| `20261122120100_spoon_store_functions.sql` | One RPC per store method: `get_spoon_day`, `set_spoon_starting_energy`, `create_spoon_task`, `update_spoon_task`, `delete_spoon_task`, `complete_spoon_task`, `undo_spoon_completion`, `list_unfinished_previous_spoon_tasks`, `move_spoon_task_to_today`. Only `authenticated` can call them |

How access works:

- **Reads:** the signed-in user can `SELECT` their own rows in `spoon_days`,
  `spoon_tasks` and `spoon_effects`. RLS limits each row to `auth.uid() = user_id`.
- **Writes:** nobody can insert, update or delete these tables directly. Every
  write goes through one of the functions above. Each function checks the user,
  the revision and the operation ID, then applies the 0–5 rules in a single
  transaction. `spoon_operations` has no policies and can't be read from the app.
- **Errors:** the functions raise custom codes that the store turns into
  `SpoonStoreError` codes: `SP400` → `validation`, `SP404` → `missing-task`,
  `SP409` → `conflict`, `SP428` → `unanswered-energy`. Anything else becomes
  `unavailable`.
- **"Today":** the app sends the device's local date. The database accepts it
  only if it's within one day of the UTC date, so a phone with a badly wrong
  clock gets "Check that this device's date is correct."

> **Keep in sync:** if the contract in `contracts.ts` changes (field names, the
> 0–5 range, task kinds or priorities), these migrations need a new migration to
> match. Don't edit migrations that have already been pushed to a shared project.

## Local setup

Requires Docker Desktop (see the [README](../README.md#supabase-only-for-real-backend-work)).

```bash
npx supabase start
npx supabase migration list --local   # both spoon migrations should show in both columns
```

If either is missing, apply them:

```bash
npx supabase migration up     # applies pending migrations, keeps existing data
# or, to rebuild from scratch (deletes local users and rows):
npx supabase db reset
```

Run the database tests (pgTAP). Each file runs in a transaction that rolls back,
so the test users and rows are never kept:

```bash
npx supabase test db
```

Expected: `Files=6, Tests=108 … Result: PASS`. The three spoon files cover:

- `spoon_rls_test.sql`: account A can't read or change account B's rows, direct
  writes are blocked, and signed-out users can't call the functions.
- `spoon_balance_test.sql`: 0–5 bounds, capped spends and recharges, undo of
  the applied change, explicit zero versus unanswered, and changing starting energy.
- `spoon_operations_test.sql`: retries with the same operation ID, stale
  revisions, moving tasks to today, and new days starting unanswered.

Run the store's unit tests (fake client, no backend needed):

```bash
npm run test:services --workspace mobile
```

To use the real store in the app, set `apps/mobile/.env.local` from
`apps/mobile/.env.example`, using the URL and publishable key printed by
`npx supabase status`.

## Hosted setup

Use the team's development project, not one with real users' data. Jamie
coordinates access (see #70). The project goes in Canada (`ca-central-1`).

1. **Link the project.** You'll be asked for the database password. Type it
   yourself; don't paste it into chat or commit it.

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   ```

2. **Preview, then push** the migrations:

   ```bash
   npx supabase db push --dry-run   # should list only the two spoon files, if the health ones are already there
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

4. **Check these in the SQL editor:**

   - [ ] RLS is enabled on all four tables (`rowsecurity` is `true` for each):

         ```sql
         SELECT tablename, rowsecurity
         FROM pg_tables
         WHERE schemaname = 'public' AND tablename LIKE 'spoon_%';
         ```

   - [ ] There are exactly three policies, all `SELECT`, on `spoon_days`,
         `spoon_tasks` and `spoon_effects`, and none on `spoon_operations`:

         ```sql
         SELECT tablename, policyname, cmd
         FROM pg_policies
         WHERE schemaname = 'public' AND tablename LIKE 'spoon_%'
         ORDER BY tablename;
         ```

   - [ ] `authenticated` can only select, and only from the three tables (this
         should return three `SELECT` rows):

         ```sql
         SELECT table_name, privilege_type
         FROM information_schema.role_table_grants
         WHERE grantee = 'authenticated' AND table_name LIKE 'spoon_%';
         ```

   - [ ] The nine functions exist, `authenticated` can execute them and `anon`
         can't (every row should be `true, false`):

         ```sql
         SELECT p.proname,
                has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
                has_function_privilege('anon', p.oid, 'EXECUTE') AS anon
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname LIKE '%spoon%'
         ORDER BY p.proname;
         ```

   - [ ] Settings → API → Exposed schemas includes `public` and does **not**
         include `spoons_private`.

5. **Two-account check in the app.** This is the end-to-end check #92 needs.
   Point `.env.local` at the hosted URL and publishable key and sign in as
   test account A. Set starting energy, add a spend task and a recharge task,
   and complete and undo one. Close and reopen the app and confirm the same
   state comes back. Then sign in as account B and confirm none of A's data
   appears.

   Delete both test accounts afterwards. The foreign keys have no `ON DELETE`,
   so delete their rows first, in this order:

   ```sql
   -- replace with the test accounts' user IDs
   DELETE FROM public.spoon_operations WHERE user_id IN ('<a>', '<b>');
   DELETE FROM public.spoon_tasks      WHERE user_id IN ('<a>', '<b>');
   DELETE FROM public.spoon_effects    WHERE user_id IN ('<a>', '<b>');
   DELETE FROM public.spoon_days       WHERE user_id IN ('<a>', '<b>');
   ```

## Rolling back

There are no down migrations. To undo on a disposable project, drop the nine
`public` spoon functions, the four `spoon_` tables and the `spoons_private`
schema (`DROP SCHEMA spoons_private CASCADE`), then run
`npx supabase migration repair --status reverted <version>` for `20261122120000`
and `20261122120100`. On a shared project, add a new migration instead.
