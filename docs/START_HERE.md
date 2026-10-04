# Build your feature from this starter

This is a small development foundation, not a finished login or settings feature.
No new packages are required. Run the commands in the [README](../README.md).

## What is here

- `/`: links to each independent preview.
- `/login`: mounts `LoginScreen` with a fake `signIn` function.
- `/settings`: mounts `SettingsScreen` with editable, temporary state.
- `/home`: a placeholder destination, deliberately accessible without login.
- `/playground`: a working example of fake success/error responses, and space to try a component.

These routes are available only in development. Fake accounts are not authentication,
and passing a preview check does not prove real login, persistence or accessibility.
Design values are temporary; designers still own the approved appearance and flows.

## Where to start

All paths below are relative to `apps/mobile/src/`. Do not rename the shared props
or change their meanings without agreeing with the people using them.

| Work | File to implement | What you can use now | Independent check |
| --- | --- | --- | --- |
| Login form | `features/auth/login-screen.tsx` | `LoginScreenProps`; fake service already supplied by `/login` | Enter demo credentials; check error/loading/success and the home transition |
| Settings controls | `features/settings/settings-screen.tsx` | `SettingsScreenProps`; state supplied by `/settings` | Change each control and see its value change without storage |
| Shared button | Create `components/app-button.tsx`, export `AppButton` | `AppButtonProps` | Mount it in your own preview; verify press, disabled and busy states |
| Shared input | Create `components/text-field.tsx`, export `TextField` | `TextFieldProps` | Mount with `useState`; verify typing, password masking and error text |
| Real login service | Create `features/auth/supabase-auth.ts` | `AuthService`; reuse existing `lib/supabase.ts` | Test with a development backend/account; UI colleagues continue using the fake |
| Shared styles | Extend `constants/theme.ts` | Existing `Colors` and `Spacing`; `Settings` values | Demonstrate text-size/colour/motion choices in a preview |
| Saved preferences | Create `features/settings/settings-storage.ts` | `Settings` shape | Test saving/loading on the intended platform; controls do not wait for storage |
| Login-aware navigation | Update the route wrappers after agreeing ownership | `AuthService.getUser/subscribe/signOut` | Use a single shared service instance and check loading, signed-out and signed-in routes |

These boundaries match the revised tickets; they are not named assignments or
confirmed point estimates. Two people should not independently edit the same route wrapper.
For button/input work, copy the playground into a uniquely named route such as
`app/button-preview.tsx`; mount your component there so colleagues can preview theirs
without editing your file. Remove temporary previews before a real release.

## The small agreements

`foundation/contracts.ts` is the reference for inputs and outputs (TypeScript types).
A screen takes props: values and functions passed in by its parent route.

**Login:** `await signIn({ email, password })` resolves to either
`{ ok: true, user }` or `{ ok: false, message }`. On success the form calls
`onSignedIn(result.user)`. The form owns field values, loading and error display;
the route owns navigation. Disable repeated submission while waiting, and restore
controls afterward. The real adapter should return a safe message for expected
failures; the UI should also recover if a call unexpectedly throws.

The demo accepts only `demo@example.com` / `demo-only`. Anything else returns an error.
It makes no network calls and retains no password. Each preview owns its own demo
service; leaving/reloading can reset it. This is deliberately not shared app login.

**Auth service:** `getUser()` returns a user or null. `subscribe(listener)` observes
future changes and returns a function that stops listening. `signOut()` clears the
user. The real adapter implements the same interface; the application owner later
creates ONE shared instance, handles initial loading/session changes, and protects
routes. Direct access to `/home` is currently a preview feature, not a security control.

**Settings:** Controls receive `settings` and call
`onChange({ ...settings, textSize: 'large' })` (or update another field).
They do not write storage. The later storage module exports
`loadSettings(): Promise<Settings | null>` and
`saveSettings(settings: Settings): Promise<void>`; null means no saved preferences.
It validates loaded values against `Settings`. The integration owner handles loading
and failures. Applying preferences across the app and saving them are still separate
product work; the current route holds only temporary local state.

**Button/input:** Use the exported prop types. A busy button must prevent repeated
presses, and inputs must retain their visible labels. Screens can temporarily use
React Native's `Button`/`TextInput` until shared components are merged, while keeping
the same data flow. Replacing them later is an integration check, not proof they work now.

## Checking your work

Run `npm run typecheck --workspace=mobile` and `npm test --workspace=mobile` from
the repo root. The starter includes three small tests for the fake service using
Node's built-in runner. React Native component tests need an agreed compatible test
setup later; do not independently install competing frameworks. Existing `expo lint`
is not a configured check yet.

For each feature, try its normal behavior, an error case and relevant accessibility
behavior. Add meaningful automated tests when the shared tools support that feature.
Tests and debugging are part of feature ownership; do not hand all checking to one
junior or call a fake-backend check a real-backend pass. Record what you could not test.

Before finishing a connected feature, its owners must also test the real combination:
real login with navigation; settings with styling and storage. No starter eliminates
that coordination. Ask for help when blocked; resource links are optional, not homework.

## Access and next steps

Developers can propose code, tests and CI configuration in PRs. Jamie or the relevant
account owner handles repository secrets, protected settings, paid services and account
access. Do not make administrative access a hidden prerequisite of a UI task.

Jamie should review this starter with one developer and merge it through the team's
normal review process before developers build on it. The GitHub tickets have been
revised for these placeholders and interfaces; confirm the starter is merged and your
checkout includes it before claiming dependent work. The two-week commitment still
needs a capacity/dependency check. Eight people can start different pieces, but they
cannot independently certify the complete product before integration.
