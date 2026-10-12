# Sprint 1 demo

## Goal

Show that the mobile starter gives the team working, independent preview flows
for login, settings, and component work. This should lay the foundation for future development, features, and workflows.

## Before the demo

From the repository root, run:

```bash
npm ci
npm run typecheck --workspace=mobile
npm test --workspace=mobile
npm run web --workspace=mobile
```

Open the local web address shown by Expo. An iPhone or iPad simulator may be used instead. An iPad is preferred.

## Demo flow

1. Open `/` and show the links to the four independent preview routes.
2. Open **Login preview**. Verify that the login forms work. Use test credentials to verify logins are successful. Use component playground to simulate successes and failures.
3. Return to Login preview and submit an incorrect password to show the error state and recovery.
4. Open **Settings preview**. Verify all the settings work.
5. Reload Settings preview to show that preferences are deliberately not saved.
6. Open **Component playground**. Run both fake-success and fake-error actions; show the status message announced on the screen.

## Important notes and key checklist:

- [ ] The login account is fake: no network call occurs, and no password is kept.
- [ ] Settings state is temporary and does not yet apply across the app.
- [ ] The home screen is a placeholder and is intentionally reachable without login.
- [ ] No Supabase account, environment variables, or Docker setup is required for
  this demo.

## Demo success criteria

- Type checking and the fake-auth tests pass.
- Each preview route opens independently.
- Login demonstrates success and failure; settings demonstrate live temporary updates; the playground demonstrates both fake outcomes.
- All features are exaimed and pass both basic and accessibility tests (voiceovers, text size changes, usability)
- No actual credential setups with supabase or environment variables are used in the demo
