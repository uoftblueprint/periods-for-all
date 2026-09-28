# Periods for All

Expo app for iPhone and iPad. TypeScript, React Native, SDK 57.

## Structure

- `apps/mobile` is the Expo app. Routes live in `src/app`. The Supabase client is `src/lib/supabase.ts`.
- `supabase/` is the local backend. Table SQL goes in `supabase/migrations`.
- The root `package.json` is an npm workspace for `apps/*`.

## Supabase

Install Docker Desktop, then from the repo root:

```bash
npx supabase start
npx supabase status
```

`status` prints the local API URL and publishable key. Copy them into `apps/mobile/.env.local` (see `apps/mobile/.env.example`). The iOS Simulator can use `http://127.0.0.1:54321`.

New tables:

```bash
npx supabase migration new <name>
```

Write the SQL in the file that command creates, then apply it with `npx supabase db reset`.

Stop the stack with `npx supabase stop`. A hosted project in Canada (`ca-central-1`) is a separate step, when you create it in the Supabase dashboard.

## iPad

`apps/mobile/app.json` sets `ios.supportsTablet` and allows rotation, so iPad runs the app at full size instead of a scaled iPhone layout.

## Run

Use Node 22 (`nvm use 22`).

```bash
cd apps/mobile
npm run ios
```

In the Expo terminal, press `i` and choose an iPad simulator. Check both an iPad Pro 13-inch and an iPad mini.
