# Periods for All

UofT Blueprint’s accessible period and energy-management app for Periods for All.
Built with Expo, React Native and TypeScript, with Supabase planned for real authentication
and backend data. The app targets iPhone and iPad; the browser is a convenient development preview.

## What works right now

The starter is merged into `main`. It provides independent preview pages, shared interfaces,
a fake login service and small example tests. **The login form, settings controls, real login,
protected product navigation and saved preferences are still developer work.**

The previews use fake accounts and temporary state. They require **no Docker, Supabase
credentials or `.env.local` file**. Production mode deliberately displays a development-only
message; this is not a release-ready app. Designers own the final appearance and flows.

## Run it for the first time

You need Git and Node 22 (22.6 or newer within that version; npm comes with Node).
The `.nvmrc` selects Node 22. If you use nvm, run `nvm install` and `nvm use` from the repo root.

Clone once, then open the folder in VS Code:

```bash
git clone https://github.com/uoftblueprint/periods-for-all.git
cd periods-for-all
```

Already have the repo? Open your existing `periods-for-all` folder instead. Make sure your
branch includes the merged starter before starting a dependent ticket; ask for help if you
have local changes you are unsure how to preserve.

In VS Code’s terminal, from the repository root:

```bash
npm ci
npm run web --workspace=mobile
```

Open the address printed in the terminal, usually `http://localhost:8081`.
Keep the terminal running; use **Ctrl+C** to stop it. For later launches, just run the web
command again. Run `npm ci` again when the dependency lockfile changes.

## Explore the starter

| Page | What you can do now |
| --- | --- |
| `/` | Open the other previews from the developer starting page |
| `/login` | See the login placeholder; its parent already supplies a fake sign-in function |
| `/settings` | See the settings placeholder; its parent owns temporary settings state |
| `/home` | See a simple destination, open without authentication for development |
| `/playground` | Try fake success/error buttons and mount a component independently |

The fake service accepts `demo@example.com` / `demo-only`; these are not real credentials.
The playground buttons supply them for you. There is no login form to type into yet.
The fake service makes no network calls; its state can reset when a preview is recreated.

## Find the code for your ticket

| Location | Purpose |
| --- | --- |
| [`apps/mobile/src/app/`](apps/mobile/src/app/) | Route files: mount screens, pass their inputs and handle navigation |
| [`apps/mobile/src/features/auth/login-screen.tsx`](apps/mobile/src/features/auth/login-screen.tsx) | Login-screen placeholder to implement |
| [`apps/mobile/src/features/settings/settings-screen.tsx`](apps/mobile/src/features/settings/settings-screen.tsx) | Settings-screen placeholder to implement |
| [`apps/mobile/src/components/`](apps/mobile/src/components/) | Reusable UI; create the button/input files named in your ticket here |
| [`apps/mobile/src/foundation/contracts.ts`](apps/mobile/src/foundation/contracts.ts) | Shared data shapes and component inputs/outputs |
| [`apps/mobile/src/foundation/demo-auth.ts`](apps/mobile/src/foundation/demo-auth.ts) | Small fake implementation of the login service |
| [`apps/mobile/src/constants/theme.ts`](apps/mobile/src/constants/theme.ts) | Existing colours, fonts and spacing |
| [`apps/mobile/src/lib/supabase.ts`](apps/mobile/src/lib/supabase.ts) | Existing client for real-backend work; requires environment values when imported |
| [`apps/mobile/tests/`](apps/mobile/tests/) | Current fake-service tests |
| [`supabase/`](supabase/) | Local backend configuration |

An **interface** is an agreement about the values and functions another piece of code expects.
In `contracts.ts`, `LoginScreenProps` and `SettingsScreenProps` describe screen inputs;
`AuthService` describes login/logout/current-user functions; `Settings` describes preferences;
`AppButtonProps` and `TextFieldProps` describe the shared components the team will build.

For example, the login screen calls `signIn({ email, password })`. It receives either
`{ ok: true, user }` or `{ ok: false, message }`. It can be built against the fake implementation
while another developer implements real login behind that same interface.

Read [START_HERE.md](docs/START_HERE.md) for the exact agreements, file boundaries and examples.
Do not rename shared inputs or change their meaning without coordinating with their users.

## Work on a ticket

1. Read the issue’s starting files, interface, prerequisites and completion checks. Confirm
   your first task and reviewer with Jamie/Janice before coding.
2. Work on a branch for your ticket, based on the team’s current `main`. Keep changes small.
3. Implement your feature in its own file. For isolated UI checks, copy the playground pattern
   into your own route, such as `app/button-preview.tsx`, to avoid everyone editing one preview.
4. Use the supplied fake functions or temporary native controls when the ticket allows it.
   Do not wait for unrelated features, but do not guess a missing interface—ask first.
5. Check the behavior and open a PR explaining what changed, which issue it belongs to,
   what you checked and anything still blocked. Request review in `#pr-reviews`.
6. Complete the connected checks with the relevant feature owner before claiming the complete
   product flow works. A fake-login pass is not a real-backend pass.

Developers own relevant tests, debugging and accessibility checks for their features. Small
CI changes can be proposed in PRs; account access, repository secrets and protected settings
need the appropriate maintainer. Ask in `#development` when blocked rather than waiting for standup.

Resources are optional help, not research assignments. AI may explain, debug or review code;
you must understand and verify changes you keep. Never share secrets or real user data.

## Run the checks

From the repository root:

```bash
npm run typecheck --workspace=mobile
npm test --workspace=mobile
```

Typecheck looks for TypeScript errors. The three current tests cover only the fake login
service, using Node’s built-in test runner. They do not prove UI, real authentication, device
storage or accessibility works. Native/component testing tools are a later shared task;
coordinate before adding them. The existing `lint` command still needs ESLint configuration.

If you add routes and TypeScript still reports an old route list, restart Expo to regenerate
its local route types. A fresh checkout can run the checks before its first Expo launch.

## iPhone / iPad checks

For the iOS Simulator, use a Mac with Xcode and an installed simulator runtime:

```bash
npm run ios --workspace=mobile
```

Use the Expo terminal’s simulator options to select a device. The app configuration enables
iPad support and rotation, but those still need runtime checks. For a physical device,
confirm the supported development-build path and account access with Jamie. Browser success
or an iOS JavaScript bundle does not prove the app works on an iPhone/iPad.

## Real-backend work only

UI previews do not need these steps. For a ticket that actually connects Supabase, install
and start Docker Desktop, then from the repo root:

```bash
npx supabase start
npx supabase status
```

Using [`apps/mobile/.env.example`](apps/mobile/.env.example), create
`apps/mobile/.env.local` and fill in the local API URL and public/publishable key from the
status output. Never put a service-role key in the app or commit local environment files.
Use synthetic accounts. Restart Expo after changing environment values.

The iOS Simulator can use the local URL; a physical phone needs a reachable development
address, not the phone’s own `127.0.0.1`. Ask the backend owner for the agreed setup.
The starter does not verify local backend readiness or provision a hosted Supabase project.

Stop the local backend when finished:

```bash
npx supabase stop
```

For schema work, agree on a migration with the backend owner. Do not reset a populated local
database as a routine setup step. The existing seed-file configuration also needs verification
by the backend setup ticket.

## Common setup problems

- **Port already in use:** Another Expo server may already be running. Open its address or
  accept another port; use the address printed by your current terminal.
- **Missing packages:** Run `npm ci` from the repository root, not an unrelated folder.
- **Missing Supabase variables during UI work:** Check whether your preview accidentally imports
  the real client. Starter previews should use `demo-auth.ts`.
- **No iOS simulator:** Use the web preview to begin UI work and ask for help with Xcode/device setup.
- **Tests mention module-format inference:** Node may print this warning for the TypeScript fake
  service. Check the actual pass/fail summary; the warning itself is not a failed test.

Do not run `reset-project`: it would move the shared starting code. Keep passwords, tokens
and personal data out of commits, screenshots and issue reports.
