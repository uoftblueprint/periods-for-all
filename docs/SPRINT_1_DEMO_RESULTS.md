# Sprint 1 demo results

**Date:** 2026-10-18
**Platform:** Web (Chrome, Windows 11)
**Auth:** Fake (no Supabase, no real credentials)
**Storage:** Not tested (settings controls not implemented)

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
| 5 | Settings preview: controls work | BLOCKED | Settings screen is still a placeholder, needs F11 |
| 6 | Settings preview: preferences not saved on reload | BLOCKED | Can't test, settings controls not implemented |
| 7 | Component playground: fake-success and fake-error actions | PASS | Status messages display correctly |
| 8 | Component playground: button disabled/busy states | PASS | Disabled and busy buttons correctly ignore presses |
| 9 | Keyboard accessibility | PASS | Tab navigation works on login and playground |

## Checklist

- [x] The login account is fake: no network call occurs, and no password is kept
- [ ] Settings state is temporary and does not yet apply across the app — not testable, controls not implemented
- [x] The home screen is a placeholder and is intentionally reachable without login
- [x] No Supabase account, environment variables, or Docker setup is required for this demo
- [ ] All features work correctly to their description — settings blocked on F11
- [ ] All features have accessibility labels, roles, hints, and states where appropriate — not fully testable without settings

## Blocked items

- **Settings (F11):** Settings screen is a placeholder. Accessibility controls (text size, color scheme, reduce motion) are not implemented. This blocks steps 5, 6, and full accessibility testing.
- **Typecheck:** Two errors from F04 and F01/F18 that are not related to demo functionality.

## Summary

Login and component playground work as expected. Settings is blocked on F11. Typecheck has pre-existing errors from other branches. Implementation owners for F04 and F11 should fix their respective issues.
