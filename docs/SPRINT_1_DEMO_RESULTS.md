# Sprint 1 demo results

## Status: partial verification; connected demo remains open

Updated November 1, 2026. This report records completed checks and outstanding
work. Merging the report does not complete F19 (#23) or certify the full app demo.

## Current automated checks — November 1

Checked the F19 branch after merging main at `48cd5ee` in a temporary checkout.
Auth/network responses in these tests are fakes; no live Supabase account was
used. Storage unit checks use fake/injected storage and do not prove retention
through an actual app restart.

| Check | Result | Evidence / limit |
| --- | --- | --- |
| `npm run typecheck --workspace=mobile` | PASS | No TypeScript errors. |
| `npm run test:services --workspace=mobile` | PASS | 153 tests passed; none failed or skipped. |
| `npm run test:components --workspace=mobile` | PASS | 34 tests across 6 suites passed. |
| Login/provider behavior | PASS (automated only) | Existing service and component tests pass; real-account journey not rerun. |
| Protected Home route | Present in code; manual check pending | Root layout guards Home with signed-in status. The earlier unprotected-Home note is obsolete. |
| Settings controls and storage helpers | PASS (automated only) | Existing checks pass; helper tests do not prove connected persistence. |

## Earlier manual preview checks — Ethan, October 18

Platform: web, Chrome on Windows 11. Auth: fake account. Storage: temporary
in-memory settings preview. These are historical observations, not a November 1
manual rerun or evidence of a real-account/device demo.

| Check | Historical result |
| --- | --- |
| Demo login succeeds; wrong password and empty inputs show errors | PASS |
| Text size, colour scheme, and reduced-motion controls respond | PASS |
| Playground fake success/error and disabled/busy buttons | PASS |
| Keyboard navigation on login and playground | PASS |

The preview reset its settings on reload. That is a limitation of the preview,
not a pass for the sprint's preference-retention requirement. Earlier counts of
19 tests and the reported TypeScript failures have been superseded by the
November 1 automated results above.

## Remaining integrated checklist

| Checklist item from SPRINT_1_DEMO.md | Status | Follow-up |
| --- | --- | --- |
| Real synthetic-account sign-in, rejected sign-in, sign-out, and protected-route journey | NOT RERUN | Ethan reruns against the agreed development backend/build; record platform, build and result. |
| Saved preferences applied across the connected app and restored after restart | BLOCKED | Nick's S2R-07, PR #67, owns connecting SettingsProvider, storage and routes. After it merges, Ethan verifies change → close/reopen → retained appearance, including failure/retry. |
| Screen-reader labels, states and operation throughout the integrated flow | PENDING | Automated attributes are not a substitute for VoiceOver/device checks. Record the actual checks and any limitations. |
| Large text, colour/motion behavior, email keyboard, password masking and repeated-submit behavior on the agreed device | PENDING | Feature tests provide supporting evidence; complete the device walkthrough and record pass/fail/blocked for each item. |

PR #67: https://github.com/uoftblueprint/periods-for-all/pull/67
F19: https://github.com/uoftblueprint/periods-for-all/issues/23

## Handoff

Nick owns the settings/route integration in #67; F19 does not duplicate that
implementation. Ethan remains responsible for rerunning and updating the
integrated demo results after that dependency merges, with feature owners fixing
any defects found. Keep #23 open until the remaining demo checks have recorded
results and Jamie accepts the outcome. Use synthetic data only.
