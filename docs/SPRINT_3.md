# Sprint 3 health-data agreement

Sprint 3 screens share the contracts and catalogs in
`apps/mobile/src/features/health/`. These files let screen owners build and test
against the same data shapes before the Supabase-backed store and final routes
are ready.

Changes to these contracts affect several tickets. Discuss a proposed change
with the affected owners before merging it.

## Shared contracts

The source of truth is `apps/mobile/src/features/health/contracts.ts`:

```ts
export type LocalDate = string; // YYYY-MM-DD, a calendar day, not a UTC timestamp

export type Mood = 'verySad' | 'sad' | 'neutral' | 'happy' | 'veryHappy';
export type Flow = 'none' | 'veryLight' | 'light' | 'normal' | 'heavy' | 'veryHeavy';

export type DailyLog = {
  date: LocalDate;
  mood: Mood | null;
  flow: Flow | null;
  physicalSymptoms: string[] | null;
  emotionalSymptoms: string[] | null;
  reflection: string | null;
};

export type DailyLogPatch = Partial<Omit<DailyLog, 'date'>>;

export type PeriodSetup = {
  lastPeriodStart: LocalDate | null;
  cycleLength: number | null;
  periodLength: number | null;
  step: 'intro' | 'lastPeriod' | 'cycle' | 'length' | 'complete';
};

export interface HealthStore {
  getPeriodDays(from: LocalDate, to: LocalDate): Promise<LocalDate[]>;
  updatePeriodDays(change: {
    add: LocalDate[];
    remove: LocalDate[];
  }): Promise<void>;
  getDailyLog(date: LocalDate): Promise<DailyLog>;
  patchDailyLog(date: LocalDate, patch: DailyLogPatch): Promise<DailyLog>;
  getPeriodSetup(): Promise<PeriodSetup>;
  savePeriodSetup(value: PeriodSetup): Promise<void>;
}
```

Import these definitions instead of recreating screen-specific versions.
`foundation/contracts.ts` remains the agreement for the earlier auth, settings,
and shared-component work; Sprint 3 health types do not replace it.

## Data semantics

- `LocalDate` is a local calendar day in `YYYY-MM-DD` form. It is not a UTC
  timestamp. Health stores reuse the helpers in
  `features/calendar/calendar-dates.ts` when validating dates.
- `null` means that the user has not answered a field.
- An empty symptom array means the user explicitly selected no symptoms. It is
  different from `null`.
- `flow: 'none'` means the user answered "No Flow." It is different from
  `flow: null`.
- An empty reflection clears the saved reflection to `null`.
- A `DailyLogPatch` changes only the fields it provides. Omitted fields retain
  their existing values.
- A missing daily-log row is returned with the requested date and all answers
  set to `null`.
- Period-day reads include both the `from` and `to` dates.
- Period marks and daily flow answers are separate user-entered values. Updating
  one must not silently update the other.
- Updating period days must not delete or replace symptoms recorded for those
  days.
- Store methods reject when a read or save fails; a failed save is never
  reported as successful.

## Catalogs

`apps/mobile/src/features/health/catalog.ts` is the source of truth for mood,
flow, physical-symptom, and emotional-symptom labels. Store catalog IDs rather
than labels so wording can change without migrating saved data.

UI code may use the catalog-derived symptom ID types for its controls. The
shared `DailyLog` contract intentionally keeps symptom values as `string[]`.

## File ownership

| Area | Owner | Agreement |
| --- | --- | --- |
| `features/health/contracts.ts` | S3-01 | Shared public shapes; coordinate before changing them. |
| `features/health/catalog.ts` | S3-01 | Shared IDs and display labels; do not duplicate labels in screens. |
| `features/health/demo-health-store.ts` | S3-01 follow-up | In-memory sample data and controllable read/save failures; no Supabase or real user data. |
| Supabase-backed health store | S3-02 | Implements `HealthStore` without changing its meaning. |
| Sprint 3 screens | S3-03, S3-04, S3-05, and S3-07 | Consume the shared contracts, catalogs, and demo store. |
| Store and route integration | S3-06 and S3-08 | Connect completed screens to stores and navigation. |

S3-01 does not own database work, authentication, app-wide state, real route
integration, or the auth/settings providers.

## Dependency order

1. Merge the S3-01 contracts and catalogs so all owners can import the same
   types and labels.
2. Add the S3-01 demo store and the S3-02 real store against those contracts.
3. Screen owners build independently using the demo store; they do not need
   Supabase or finished routes.
4. S3-06 and S3-08 connect the completed screens and stores.

If a contract must change after step 1, notify the store, screen, and integration
owners before changing it so dependent branches can update together.
