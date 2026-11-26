# Sprint 4 spoon journey — demo checklist and volunteer testing handoff

Related to #100 (S4-10).

## Status: checklist prepared; final validation blocked on S4-08/S4-09

Updated November 26, 2026. Demo script and volunteer prompts are ready.
Phone/iPad screenshots and real-backend verification are pending S4-08 (layouts)
and S4-09 (route wiring). This document does not certify a complete demo until
those sections are filled in and the readiness decision at the bottom is updated.

---

## Build and run instructions

### Prerequisites

- Node 22.6+
- Clone the repo and run `npm install` from the project root

### Start the app

From the repo root:

```
cd apps/mobile
set "EXPO_NO_METRO_LAZY=1" && npm run web -- --clear
```

Open `http://localhost:8081` in a browser. The spoon journey lives on the
**Spoons** tab in the bottom nav (once S4-09 wires the route). Until then,
individual preview routes are available:

| Feature | Preview URL |
| --- | --- |
| Previous tasks (S4-07) | `/previous-tasks-preview` |
| Daily energy + overview (S4-03) | `/daily-energy-preview` (if available) |
| Task list (S4-04) | `/task-list-preview` (if available) |

Preview routes use fabricated data in a sample store. They do not connect to
Supabase.

---

## Demo checklist

Walk through each step in order. Record pass/fail and any issues. Repeat on
phone, iPad, and at the largest text size.

### 1. Choose today's energy

| Step | Expected result |
| --- | --- |
| Open the Spoons tab | Energy setup screen appears; no spoons selected yet |
| Tap 3 spoons | Balance shows 3; display updates immediately |
| Edit energy to 5 spoons | Balance updates to 5; completed task effects are retained and re-bounded |

### 2. Plan a task

| Step | Expected result |
| --- | --- |
| Tap "Add a task" | Task editor opens with empty fields |
| Enter name "Cook dinner", kind "spend", amount 2 | Fields accept input; amount validated 0–5 |
| Save the task | Task appears in Today's Tasks list; balance unchanged (planned tasks don't affect it) |

### 3. Complete the task

| Step | Expected result |
| --- | --- |
| Tap to complete "Cook dinner" | Balance drops from 5 to 3 (spent 2) |
| Check the task row | Shows completed state (checkmark or strikethrough per design) |

### 4. Undo the completion

| Step | Expected result |
| --- | --- |
| Undo "Cook dinner" | Balance restores from 3 to 5 |
| Check the task row | Returns to incomplete state |

### 5. Add and complete a recharge task

| Step | Expected result |
| --- | --- |
| Add task "Take a break", kind "recharge", amount 2 | Task appears in list |
| Complete "Cook dinner" first (spend 2) | Balance: 5 → 3 |
| Complete "Take a break" (recharge 2) | Balance: 3 → 5 |
| Try recharging when already at 5 | Activity recorded but balance stays at 5; no overflow |

### 6. Persistence — close and reopen

| Step | Expected result |
| --- | --- |
| Close the app or navigate away | — |
| Reopen and return to Spoons tab | Same energy, same tasks, same completion states shown |

**Note:** This step verifies real persistence only with a live backend (S4-02).
In the sample-store preview, data resets on reload — that is expected and not a
failure. Label which store was used when recording the result.

### 7. New day and previous-task rollover

| Step | Expected result |
| --- | --- |
| Simulate a new day (use controlled test date or wait a day) | New day starts with no energy selected |
| Previous Tasks section appears | Shows yesterday's unfinished tasks with count and collapse chevron |
| Tap checkbox on a previous task | Task moves to today's list; disappears from previous section |
| Completed tasks from yesterday | Do NOT appear in Previous Tasks (only unfinished ones roll over) |
| Energy from yesterday | Does NOT carry over; today starts unanswered |

### 8. Edge cases

| Step | Expected result |
| --- | --- |
| Complete a task that costs more than current balance | Warning shown; Continue records completion at zero, Cancel does nothing |
| Tap move on a previous task twice rapidly | Only one move happens; no duplicate |
| Force a save failure (use sample store's failNextWrite) | Error message appears; data is not lost; retry works |
| Account switch / sign out | Spoon data clears; different account sees its own data |

### 9. Layout checks

Run each check and record pass/fail:

| Check | Phone | iPad portrait | iPad landscape |
| --- | --- | --- | --- |
| Standard text size — no clipped controls | | | |
| Large text size — no overflow | | | |
| Largest text size — readable, no overlap | | | |
| Dark theme — colors readable | | | |
| High contrast theme — colors readable | | | |

---

## Volunteer testing prompts

Use these plain-language questions with a tester who has not seen the app before.
Give them the app on a device with fabricated data already loaded. Do not coach
them through answers.

### Understanding

1. "You see a number at the top of the screen. What do you think it means?"
   — *Looking for:* they can explain it's their energy/spoon balance for today.

2. "There are two types of tasks here. What's the difference between them?"
   — *Looking for:* they distinguish spending energy from recharging energy.

3. "You just finished a task. What happened to your number?"
   — *Looking for:* they notice the balance changed and can say which direction.

### Recovery

4. "You completed a task by mistake. How would you fix that?"
   — *Looking for:* they find the undo action without help.

5. "Something went wrong and you see an error. What would you do?"
   — *Looking for:* they attempt a retry or recognize the error message.

### Navigation

6. "You have tasks from yesterday that you didn't finish. Can you find them?"
   — *Looking for:* they locate the Previous Tasks section.

7. "How would you bring one of yesterday's tasks into today?"
   — *Looking for:* they tap the move action on a previous task.

### Record for each prompt

- Did they succeed without help? (yes / with a hint / no)
- How long did it take? (immediate / some hesitation / struggled)
- Any confusion or misunderstanding? (quote what they said)

---

## Feedback worksheet

Use this table to record issues found during the demo or volunteer testing.

| # | Description | Found by | Severity | Blocks use? | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | | | high / medium / low | yes / no | open / fixed |
| 2 | | | | | |
| 3 | | | | | |

**Severity guide:**
- **High** — Prevents completing a core task (choose energy, complete/undo, rollover)
- **Medium** — Confusing or ugly but workaround exists
- **Low** — Cosmetic or minor usability polish

---

## Prioritized follow-up list

Items that surfaced during testing but do not fit in this sprint. Not a promise
to fix — a record for future planning.

| Priority | Item | Ticket / notes |
| --- | --- | --- |
| 1 | | |
| 2 | | |
| 3 | | |

---

## Demo-readiness decision

**Current status: NOT READY — blocked on S4-08 and S4-09**

| Dependency | Status | Impact |
| --- | --- | --- |
| S4-01 — Shared contract | Open (PR #101) | Types available on branch; not merged to main |
| S4-02 — Persistence | Open (PR #106) | Cannot verify real data retention |
| S4-08 — Large default + iPad layouts | No PR yet | Cannot capture layout evidence |
| S4-09 — Route wiring | No PR yet | Cannot demo from the real Spoons tab |

**What works now:** Individual preview routes with sample-store data demonstrate
the UI for energy setup, task list, completion/undo, and previous-task rollover.
These are prototype demos, not hosted-backend verification.

**What's missing:** Real Supabase persistence, integrated route from the Spoons
tab, iPad layouts, and large-default presentation. If hosted backend access is
needed, contact Jamie as access coordinator.

**Decision:** Update this section once S4-08 and S4-09 merge. Until then, demo
is sample-store only and should be labeled honestly as a prototype walkthrough.
