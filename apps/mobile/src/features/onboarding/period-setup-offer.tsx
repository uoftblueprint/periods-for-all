// S3-10: opens unfinished period setup by itself once per sign-in, after display setup.
import { useEffect } from 'react';
import { router } from 'expo-router';
import { localToday, useHealthStore, type HealthStore } from '@/features/health/health-routes';
import { createPeriodSetupSession, routeAfterDisplaySetup } from './period-setup-progress';

// Stores whose user has already been offered setup. S3-08 creates a new store for every
// sign-in, so each signed-in session is offered once, and signing out forgets it.
const offered = new WeakSet<HealthStore>();

/**
 * `active` is true only when display setup is done and home is showing. If period setup is
 * unfinished, it opens at the saved step: right after display setup for a new user, or on the
 * next launch for someone who left part-way. Finished or skipped setup never opens by itself;
 * it stays editable from home.
 */
export function PeriodSetupOffer({ active }: { active: boolean }) {
  const health = useHealthStore();
  const store = health.status === 'ready' ? health.store : null;
  const userId = health.status === 'ready' ? health.userId : null;

  useEffect(() => {
    if (!active || !store || !userId || offered.has(store)) return;
    const session = createPeriodSetupSession({ userId, store, today: localToday() });
    session.load().then(
      (setup) => {
        offered.add(store);
        if (routeAfterDisplaySetup(setup) === '/period-setup') router.push('/period-setup');
      },
      // Home stays usable and its Period setup link still works; the next visit tries again.
      () => {},
    );
    // Leaving home or signing out first cancels the offer.
    return () => session.dispose();
  }, [active, store, userId]);

  return null;
}
