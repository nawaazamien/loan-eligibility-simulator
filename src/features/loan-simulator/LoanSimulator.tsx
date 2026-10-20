import { useEffect, useMemo, useReducer, useRef } from 'react';

import type { ApiClient } from '../../api/client';
import { Button } from '../../components/Button';
import { FrameCorners } from '../../components/Frame';
import frameStyles from '../../components/Frame.module.css';
import { cx } from '../../styles/cx';
import { describeResult } from './describeResult';
import { createFormReducer, initialFormState, isResultStale } from './formState';
import { LoanForm } from './LoanForm';
import styles from './LoanSimulator.module.css';
import { ResultsPanel } from './ResultsPanel';
import type { FormRules } from './rules';
import { useCalculation } from './useCalculation';
import { useLoanData } from './useLoanData';

const NARROW_LAYOUT = '(max-width: 759.98px)';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

interface LoanSimulatorProps {
  client: ApiClient;
}

/**
 * The simulator. It first loads the validation rules and products through the API client; the
 * form appears once they are known, or a retryable error does if they cannot be loaded.
 */
export function LoanSimulator({ client }: LoanSimulatorProps) {
  const { data, retry } = useLoanData(client);

  if (data.status === 'loading') {
    return (
      <div className={styles.layout}>
        <section
          aria-labelledby="loading-heading"
          className={cx(frameStyles.frame, styles.notice, styles.fullWidth)}
        >
          <FrameCorners />
          <h2 id="loading-heading" className={styles.noticeHeading}>
            Your details
          </h2>
          <p role="status">Loading the loan details…</p>
        </section>
      </div>
    );
  }

  if (data.status === 'error') {
    return (
      <div className={styles.layout}>
        <LoadError message={data.message} onRetry={retry} />
      </div>
    );
  }

  return <LoadedSimulator client={client} rules={data.rules} />;
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <section
      aria-labelledby="load-error-heading"
      className={cx(frameStyles.frame, styles.notice, styles.fullWidth)}
    >
      <FrameCorners />
      <h2 id="load-error-heading" className={styles.noticeHeading}>
        Your details
      </h2>
      <div ref={ref} tabIndex={-1} role="alert" className={styles.loadError}>
        <p>
          <strong>We couldn't load the loan details.</strong> {message}
        </p>
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </section>
  );
}

/**
 * The form and estimate, once the rules are known. It owns the form state, runs the requests
 * the reducer asks for, and decides where focus goes after each outcome: the error summary
 * when validation fails, the estimate heading when a calculation succeeds, the failure
 * message when it does not.
 */
function LoadedSimulator({ client, rules }: { client: ApiClient; rules: FormRules }) {
  const reducer = useMemo(() => createFormReducer(rules), [rules]);
  const [state, dispatch] = useReducer(reducer, rules, initialFormState);
  useCalculation(client, state, dispatch);

  const summaryRef = useRef<HTMLDivElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);
  const handledFocus = useRef(state.focus?.n ?? 0);

  const isStale = isResultStale(state);

  useEffect(() => {
    // Runs once per focus request; editing fields never moves focus.
    const request = state.focus;
    if (!request || request.n === handledFocus.current) return;
    handledFocus.current = request.n;

    if (request.kind === 'summary') {
      summaryRef.current?.focus();
      return;
    }
    const target = request.kind === 'result' ? resultsHeadingRef.current : failureRef.current;
    if (!target) return;
    target.focus({ preventScroll: true });
    // On phones the estimate is below the form, so bring it to the top. On wide screens it is
    // beside the form, but a long form can leave it scrolled out of sight: bring it into view
    // only if it is not already.
    const reduceMotion = window.matchMedia(REDUCED_MOTION).matches;
    const behavior = reduceMotion ? 'auto' : 'smooth';
    if (window.matchMedia(NARROW_LAYOUT).matches) {
      target.scrollIntoView({ behavior, block: 'start' });
    } else {
      const box = target.getBoundingClientRect();
      if (box.top < 0 || box.bottom > window.innerHeight) {
        target.scrollIntoView({ behavior, block: 'nearest' });
      }
    }
  }, [state.focus]);

  const announcement = state.result ? describeResult(state.result).announcement : '';

  return (
    <>
      <div className={styles.layout}>
        <LoanForm
          state={state}
          dispatch={dispatch}
          rules={rules}
          isStale={isStale}
          summaryRef={summaryRef}
        />
        <ResultsPanel
          result={state.result}
          isStale={isStale}
          pending={state.pending !== null}
          failure={state.failure}
          headingRef={resultsHeadingRef}
          failureRef={failureRef}
          onRecalculate={() => {
            dispatch({ type: 'submit' });
          }}
          onRetry={() => {
            dispatch({ type: 'submit' });
          }}
          onRetrySchedule={() => {
            dispatch({ type: 'retrySchedule' });
          }}
        />
      </div>
      {/* One short polite message per successful calculation. A new element per calculation
          means an identical result is still announced, exactly once. */}
      <div aria-live="polite" className="visually-hidden">
        {state.result && <p key={state.result.calculation}>{announcement}</p>}
      </div>
    </>
  );
}
