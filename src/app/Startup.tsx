import { useEffect, useState, type ReactNode } from 'react';

import { Button } from '../components/Button';
import styles from './Startup.module.css';

/**
 * How long to wait for the in-browser mock API before explaining that it is slow. Normal
 * starts take well under a second; under heavy load (several browsers at once) one was
 * measured at about 20 s, so this is generous but bounded. A start that finishes after the
 * message appears is still used (see below).
 */
export const STARTUP_TIMEOUT_MS = 15_000;

type StartupState =
  | { readonly status: 'starting' }
  | { readonly status: 'ready' }
  | { readonly status: 'failed'; readonly reason: 'blocked' | 'timeout' };

interface StartupProps {
  /** Starts the mock API. Must be safe to call again: it returns the attempt already in flight. */
  start: () => Promise<void>;
  timeoutMs?: number;
  children: ReactNode;
}

/**
 * Shows the app once its API is ready. While the mock API starts, a status message is shown;
 * if it fails, or takes longer than the timeout, a message explains why and Try again waits
 * for it once more. A start that completes late takes the page to the app by itself. Every
 * outcome is handled, so none can become an unhandled rejection, and a stale attempt can never
 * change what is on screen.
 */
export function Startup({ start, timeoutMs = STARTUP_TIMEOUT_MS, children }: StartupProps) {
  const [state, setState] = useState<StartupState>({ status: 'starting' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      if (current) setState({ status: 'failed', reason: 'timeout' });
    }, timeoutMs);
    start().then(
      () => {
        clearTimeout(timer);
        if (current) setState({ status: 'ready' });
      },
      () => {
        clearTimeout(timer);
        if (current) setState({ status: 'failed', reason: 'blocked' });
      },
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [start, timeoutMs, attempt]);

  if (state.status === 'ready') return children;

  const retry = () => {
    setState({ status: 'starting' });
    setAttempt((n) => n + 1);
  };

  if (state.status === 'starting') {
    return (
      <main className={styles.page}>
        <h1 className={styles.heading}>Loan eligibility simulator</h1>
        <p role="status">Starting the demo…</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>
        {state.reason === 'timeout'
          ? 'The demo is taking too long to start'
          : "This demo can't start in this browser"}
      </h1>
      <p role="alert">
        {state.reason === 'timeout'
          ? 'The loan simulator answers its requests with a small in-browser service (a service worker), and it has not started yet. This can happen on a very busy device or a slow connection. Select Try again to keep waiting, or reload the page.'
          : "The loan simulator answers its requests with a small in-browser service (a service worker), and your browser didn't allow it. Private browsing, blocked site data or an unsupported browser can cause this. Try a normal window in a current Chrome, Edge, Firefox or Safari, then select Try again or reload."}
      </p>
      <div>
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      </div>
    </main>
  );
}
