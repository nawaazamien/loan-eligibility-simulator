import { useEffect, useReducer, useRef } from 'react';

import { formReducer, initialFormState, isResultStale } from './formState';
import { LoanForm } from './LoanForm';
import styles from './LoanSimulator.module.css';
import { describeEstimate } from './model/copy';
import { ResultsPanel } from './ResultsPanel';

const NARROW_LAYOUT = '(max-width: 759.98px)';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * The simulator: the design's 7/5 grid with the form on the left and the estimate on the
 * right, stacked below 760px. It owns the form state and decides where focus goes after
 * each Calculate: the error summary when it fails, the estimate heading when it succeeds.
 */
export function LoanSimulator() {
  const [state, dispatch] = useReducer(formReducer, initialFormState);
  const summaryRef = useRef<HTMLDivElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const handledSubmit = useRef(state.submitCount);

  const isStale = isResultStale(state);
  const succeeded = state.result?.calculation === state.submitCount;

  useEffect(() => {
    // Runs once per submit; editing fields never moves focus.
    if (state.submitCount === handledSubmit.current) return;
    handledSubmit.current = state.submitCount;

    if (!succeeded) {
      summaryRef.current?.focus();
      return;
    }
    const heading = resultsHeadingRef.current;
    if (!heading) return;
    heading.focus({ preventScroll: true });
    // On phones the estimate is below the form, so bring its heading into view.
    if (window.matchMedia(NARROW_LAYOUT).matches) {
      const reduceMotion = window.matchMedia(REDUCED_MOTION).matches;
      heading.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }, [state.submitCount, succeeded]);

  const announcement = state.result ? describeEstimate(state.result.estimate).announcement : '';

  return (
    <>
      <div className={styles.layout}>
        <LoanForm state={state} dispatch={dispatch} isStale={isStale} summaryRef={summaryRef} />
        <ResultsPanel
          result={state.result}
          isStale={isStale}
          headingRef={resultsHeadingRef}
          onRecalculate={() => {
            dispatch({ type: 'submit' });
          }}
        />
      </div>
      {/* One short polite message per successful calculation. A new element per
          calculation means an identical result is still announced, exactly once. */}
      <div aria-live="polite" className="visually-hidden">
        {state.result && <p key={state.result.calculation}>{announcement}</p>}
      </div>
    </>
  );
}
