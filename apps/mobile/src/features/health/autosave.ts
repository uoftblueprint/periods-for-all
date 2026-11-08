import type { DailyLog, DailyLogPatch, HealthStore, LocalDate } from '@/features/health/health-types';

export type Answers = Omit<DailyLog, 'date'>;
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type AutosaveSnapshot = { draft: Answers; status: SaveStatus };

export const REFLECTION_DEBOUNCE_MS = 500;

export const emptyAnswers: Answers = {
  mood: null, flow: null, physicalSymptoms: null, emotionalSymptoms: null, reflection: null,
};

export type Autosave = {
  readonly date: LocalDate;
  getDraft(): Answers;
  getStatus(): SaveStatus;
  /** Same object until something changes, for useSyncExternalStore. */
  getSnapshot(): AutosaveSnapshot;
  setField<K extends keyof Answers>(field: K, value: Answers[K]): void;
  blurReflection(): void;
  retry(): void;
  /** Sends everything pending and waits. Resolves false if anything is still unsaved. */
  flushAll(): Promise<boolean>;
  /** Stops all saving, ignores late results and clears the answers from memory. */
  dispose(): void;
  subscribe(listener: () => void): () => void;
};

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
  return a === b;
}

// An empty reflection means "cleared", which the store stores as null.
function toWirePatch(changes: DailyLogPatch): DailyLogPatch {
  return changes.reflection === '' ? { ...changes, reflection: null } : changes;
}

/**
 * Autosave for one day's answers. At most one save is in flight; edits made while it runs
 * are merged into the next save, so a slow older save can never overwrite a newer choice.
 * The draft is never replaced by save results, and a failed save keeps it.
 */
export function createAutosave({ date, store, initial }: {
  date: LocalDate;
  store: Pick<HealthStore, 'patchDailyLog'>;
  initial: Answers;
}): Autosave {
  let draft: Answers = { ...initial };
  let dirty: DailyLogPatch = {}; // changed but not yet sent
  let inFlight = false;
  let failed = false;
  let savedOnce = false;
  let alive = true;
  let reflectionTimer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  const hasDirty = () => Object.keys(dirty).length > 0;
  function getStatus(): SaveStatus {
    if (failed) return 'error';
    if (inFlight || hasDirty() || reflectionTimer !== null) return 'saving';
    return savedOnce ? 'saved' : 'idle';
  }
  let snapshot: AutosaveSnapshot = { draft, status: getStatus() };
  const notify = () => {
    if (!alive) return;
    snapshot = { draft, status: getStatus() };
    listeners.forEach((listener) => listener());
  };

  function commitReflection() {
    if (reflectionTimer === null) return;
    clearTimeout(reflectionTimer);
    reflectionTimer = null;
    dirty = { ...dirty, reflection: draft.reflection };
  }

  async function drain() {
    while (alive && hasDirty()) {
      const sending = dirty;
      dirty = {};
      inFlight = true;
      notify();
      try {
        await store.patchDailyLog(date, toWirePatch(sending));
      } catch {
        if (!alive) return;
        dirty = { ...sending, ...dirty }; // edits made during the failed save win
        inFlight = false;
        failed = true;
        return;
      }
      if (!alive) return;
      inFlight = false;
      savedOnce = true;
    }
  }

  function flush(): Promise<void> {
    if (running) return running; // the running loop picks up new edits
    if (!alive || failed || !hasDirty()) return Promise.resolve();
    running = drain().finally(() => {
      running = null;
      notify();
      // An edit can land between the loop's last check and this callback.
      if (alive && !failed && hasDirty()) void flush();
    });
    return running;
  }

  return {
    date,
    getDraft: () => draft,
    getStatus,
    getSnapshot: () => snapshot,
    setField(field, value) {
      if (!alive || sameValue(draft[field], value)) return;
      draft = { ...draft, [field]: value };
      failed = false; // a new edit also retries whatever failed before
      if (field === 'reflection') {
        if (reflectionTimer !== null) clearTimeout(reflectionTimer);
        reflectionTimer = setTimeout(() => {
          commitReflection();
          void flush();
        }, REFLECTION_DEBOUNCE_MS);
        notify();
        return;
      }
      dirty = { ...dirty, [field]: value };
      notify();
      void flush();
    },
    blurReflection() {
      commitReflection();
      void flush();
    },
    retry() {
      failed = false;
      notify();
      void flush();
    },
    async flushAll() {
      if (!alive) return false;
      commitReflection();
      failed = false;
      await flush();
      while (running) await running;
      return !failed && !inFlight && !hasDirty();
    },
    dispose() {
      alive = false;
      if (reflectionTimer !== null) clearTimeout(reflectionTimer);
      reflectionTimer = null;
      listeners.clear();
      draft = { ...emptyAnswers };
      dirty = {};
      snapshot = { draft, status: 'idle' };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
