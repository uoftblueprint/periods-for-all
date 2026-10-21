# Periods for All

Expo app for iPhone and iPad. TypeScript, React Native, SDK 57.

## Start here: small development foundation

Use Node 22.6 or newer (the `.nvmrc` selects Node 22). From the repository root:

```bash
npm ci
npm run web --workspace=mobile
```

Open the web address printed in the terminal (http://localhost:8081) in your browser. The starting page links to login,
settings, home, and a component playground. **No Docker, Supabase account or environment
variables are needed for these previews.** They use fake accounts and temporary state.

Read [the short developer guide](docs/START_HERE.md) for file ownership and interfaces.
Real product behavior remains to be implemented. The preview routes are disabled in
production mode; this branch is not a releasable app.

Checks from the repository root:

```bash
npm run typecheck --workspace=mobile
npm test --workspace=mobile
```

Start Expo once after adding routes so its generated route types are up to date.
The small Node test covers only the fake auth service; it is not a React Native UI
or real-backend test suite. The existing `lint` script still needs ESLint setup.

## Structure

- `apps/mobile` is the Expo app. Routes live in `src/app`. The Supabase client is `src/lib/supabase.ts`.
- `supabase/` is the local backend. Table SQL goes in `supabase/migrations`.
- The root `package.json` is an npm workspace for `apps/*`.

## Supabase (only for real-backend work)

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

## Run on IOS Simulator

The app runs on Expo Go on the IOS Simulator.

### Requirements

- A Mac. The IOS Simulator is not available on Windows or Linux; use `npm run web` instead.
- Xcode, with an IOS Simulator runtime installed (Xcode → Settings → Components).
  Open Xcode once after installing it to accept the license.
- Node 22.6 or newer. If you use nvm, `nvm use` selects the version in `.nvmrc`.

```bash
cd apps/mobile
npm run ios
```
The first run installs Expo Go on the simulator and opens the app. To pick a different
device, press `shift+i` in the Expo terminal and choose an iPhone or iPad simulator.

Check both an iPad Pro 13-inch and an iPad mini.

### Last verified on

- macOS 26.6.2, Xcode 26.0 (17A324), Node 24.13.0
- IOS 26 simulators: iPhone 16e, iPhone 17, iPad Pro 13-inch, iPad mini (A17 Pro)