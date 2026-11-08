import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Settings } from '@/foundation/contracts';
import type { AuthContextValue } from '@/features/auth/auth-provider';
import { createFinishHandler, getGateView, readCompletion } from './onboarding-logic';
import type { CompletionStore } from './completion-store';
import type { DisplaySetupProps } from './display-setup';

export type GatePresentation = {
  view: ReturnType<typeof getGateView>;
  setup: DisplaySetupProps | null;
  error: string | null;
  retry: () => void;
};

type OnboardingGateProps = {
  auth: Pick<AuthContextValue, 'status' | 'user' | 'error'>;
  sessionId: number;
  sessionKey: string;
  getSessionKey: () => string | null;
  settings: Settings | null;
  settingsError: string | null;
  onRetry: () => void;
  saveSettings: (next: Settings) => Promise<void>;
  completionStore: CompletionStore;
  render: (presentation: GatePresentation) => ReactNode;
};

export function OnboardingGate(props: OnboardingGateProps) {
  const [sessionId, setSessionId] = useState(props.sessionId);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [completion, setCompletion] = useState<{
    key: string;
    value: boolean | null;
    error: string | null;
  } | null>(null);
  const [exited, setExited] = useState(false);
  const [retry, setRetry] = useState(0);
  const [finisher] = useState(createFinishHandler);
  const mounted = useRef(true);
  const { sessionKey, getSessionKey, completionStore } = props;
  const userId = props.auth.user?.id;
  const isCurrent = () => mounted.current && getSessionKey() === sessionKey;

  // Reset before committing children, keeping the route shell/navigator mounted.
  if (sessionId !== props.sessionId) {
    setSessionId(props.sessionId);
    setDraft(null);
    setCompletion(null);
    setExited(false);
    setRetry(0);
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (draft === null && props.settings !== null) setDraft({ ...props.settings });
  }, [draft, props.settings]);

  useEffect(() => {
    if (props.auth.status !== 'signedIn' || !userId) return;
    let active = true;
    const current = () => active && mounted.current && getSessionKey() === sessionKey;
    setCompletion(null);
    void readCompletion(completionStore, userId, current).then(
      (value) => { if (current() && value !== undefined) setCompletion({ key: sessionKey, value, error: null }); },
      () => { if (current()) setCompletion({ key: sessionKey, value: null, error: 'Could not check display setup. Try again.' }); },
    );
    return () => { active = false; };
  }, [completionStore, getSessionKey, sessionKey, userId, props.auth.status, retry]);

  async function finish() {
    if (!isCurrent() || !userId || !draft) throw new Error('Display setup is not ready.');
    await finisher.finish({
      sessionKey, userId, settings: draft, isCurrent,
      saveSettings: props.saveSettings, completionStore,
    });
    if (isCurrent()) setCompletion({ key: sessionKey, value: true, error: null });
  }

  const currentCompletion = completion?.key === sessionKey ? completion : null;
  const error = props.auth.error ?? props.settingsError ?? currentCompletion?.error ?? null;
  const view = props.auth.status === 'signedIn' && !isCurrent() ? 'loading' : getGateView({
    authStatus: props.auth.status,
    settingsReady: draft !== null && props.settings !== null,
    error, complete: currentCompletion?.value ?? null, exited,
  });

  return props.render({
    view, error,
    retry: () => { setCompletion(null); props.onRetry(); setRetry((n) => n + 1); },
    setup: draft === null ? null : {
      settings: draft,
      onChange: (next) => {
        if (isCurrent() && !finisher.isPending(sessionKey)) setDraft({ ...next });
      },
      onFinish: finish,
      onExit: () => {
        if (isCurrent() && !finisher.isPending(sessionKey)) setExited(true);
      },
    },
  });
}
