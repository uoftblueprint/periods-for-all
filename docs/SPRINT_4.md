# Sprint 4 spoon contract

S4-01 defines the account-scoped `SpoonStore` and an in-memory implementation. Import the contract from `@/features/spoons/contracts` and the 0–5 policy from `@/features/spoons/balance`. A screen receives snapshots, pending/error state, and callbacks. Its caller owns operation IDs, revision checks, account changes, and navigation.

## Data and operations

- `getDay(date)` reads a local calendar day. An unseen day starts at revision 0 with null starting energy and balance. Zero means the user gave an answer. Dates use local `YYYY-MM-DD`; optional task times use `HH:mm`; activity timestamps are UTC ISO strings.
- `setStartingEnergy` requires a whole number in 0–5. It replaces the starting amount and adds the net recorded effects, then bounds the result. Keep completion history on the day the effects occurred.
- `createTask` accepts a draft with an optional date. Omit the draft date to schedule on the current local day at save time. Pass the date of the snapshot separately. `updateTask` accepts a full draft and preserves the current date when it is omitted. The editor supplies stable subtask IDs and omits any empty optional fields it wants cleared.
- `completeTask` requires starting energy and applies the portion of the requested spend or recharge that fits. `undoCompletion` reverses the actual applied change within 0–5 on the task’s day. Both record their signed effects. Ask for confirmation in the screen before sending an over-budget completion. Undo before updating or deleting a completed task.
- `listUnfinishedPreviousTasks(today)` lists unfinished earlier tasks, newest day first. `moveTaskToToday` moves the same task ID to the current local day. Rescheduling and rollover preserve energy and check revisions for both days.

## Mutations and retry

Use a new `operationId` for each intended action. Send the snapshot's date and `expectedRevision` for the source or created day and `expectedDestinationRevision` when crossing dates. For rollover, include the snapshot's `destinationDate`. If the requested day has changed by save time, reload before retrying with the new date and revision. Mutations return the affected day snapshots, source first. A successful retry with an identical request returns current snapshots for the original days, even after midnight. A changed request needs a new operation ID after an earlier request succeeded. Each changed day advances one revision. Already completed or already undone tasks keep their revision when the operation does nothing.

Catch `SpoonStoreError` and branch on `code`. For `conflict`, reload before asking the user to retry an edit. For `unanswered-energy`, show the energy prompt. For `validation` and `missing-task`, keep the draft and surface an actionable message. For `unavailable`, retry the same request with its original operation ID. The sample store uses this same error code for injected read or write failures. Each failure leaves the saved task, energy and revision intact.

## Sample data and handoff

Use `createSampleSpoonStore()` for an empty instance. Pass `fixture` as `unanswered`, `zero`, `planned`, `activity`, or `previous` to show fabricated examples. The factory returns `store` plus `failNextRead()` and `failNextWrite()`. Pass `delay(kind)` to hold a read or write while the preview shows loading. Use `now` and `createId` for deterministic checks.

S4-02 implements atomic persistence and account isolation behind the contract. S4-03 through S4-07 own screen behavior and warnings. S4-09 supplies the current account's store, refreshes the local day on resume and before writes, and discards old account state when the session ends.
