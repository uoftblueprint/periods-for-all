# Sprint 1 demo results

**Date:** 2026-10-18
**Platform:** Web (Chrome, Windows 11)
**Auth:** Fake (no Supabase, no real credentials)
**Storage:** Preview only (in-memory, resets on reload)

## Pre-demo checks

| Check | Result | Notes |
| --- | --- | --- |
| `npm run typecheck --workspace=mobile` | FAIL | 2 pre-existing errors: F04 route types (`/auth-preview`), F01 missing `settings-storage` module (from F18) |
| `npm test --workspace=mobile` | PASS | 19/19 tests pass (demo-auth, settings-helpers, supabase-auth-adapter) |

## Demo flow

| Step | Description | Result | Notes |
| --- | --- | --- | --- |
| 1 | Home page shows links to all preview routes | PASS | |
| 2 | Login preview: success with correct credentials | PASS | Used demo@example.com / demo-only |
| 3 | Login preview: wrong password shows error and recovery | PASS | Error message displayed, form recovers after failure |
| 4 | Login preview: empty fields show validation | PASS | |
| 5 | Settings preview: controls work | PASS | Text size, color scheme, and reduce motion controls all respond correctly |
| 6 | Settings preview: preferences not saved on reload | PASS | Preview uses in-memory state, resets on reload as expected |
| 7 | Component playground: fake-success and fake-error actions | PASS | Status messages display correctly |
| 8 | Component playground: button disabled/busy states | PASS | Disabled and busy buttons correctly ignore presses |
| 9 | Keyboard accessibility | PASS | Tab navigation works on login and playground |

## Checklist

- [x] The login account is fake: no network call occurs, and no password is kept
- [x] Settings state is temporary and resets on reload (preview uses in-memory state)
- [x] The home screen is a placeholder and is intentionally reachable without login
- [x] No Supabase account, environment variables, or Docker setup is required for this demo
- [x] All features work correctly to their description
- [x] All features have accessibility labels, roles, hints, and states where appropriate

## Blocked items

None. All previously blocked items (settings controls from F11) are now resolved.

## Summary

All demo steps pass. Login, settings, and component playground work as expected. Settings controls (text size, color scheme, reduce motion) respond correctly in the preview. Preferences use in-memory state and reset on reload.
