import { Calculator, CircleAlert, RefreshCw } from 'lucide-react';
import { useId, type Ref } from 'react';

import { Button } from '../../components/Button';
import { FrameCorners } from '../../components/Frame';
import frameStyles from '../../components/Frame.module.css';
import { cx } from '../../styles/cx';
import { AssumptionsDisclosure } from './AssumptionsDisclosure';
import type { CalculatedResult } from './formState';
import { ResultDetails } from './ResultDetails';
import styles from './ResultsPanel.module.css';

interface ResultsPanelProps {
  result: CalculatedResult | null;
  isStale: boolean;
  /** A calculation is in flight. */
  pending: boolean;
  /** The last calculation failed; shown with a retry. */
  failure: { message: string } | null;
  onRecalculate: () => void;
  onRetry: () => void;
  onRetrySchedule: () => void;
  headingRef: Ref<HTMLHeadingElement>;
  failureRef: Ref<HTMLDivElement>;
}

/**
 * The estimate panel. Until a calculation succeeds it explains what will appear. After one it
 * shows that snapshot's result. If the inputs change, the result stays visible but is marked
 * out of date; if a later calculation fails, it stays too, with the failure and a retry above it.
 */
export function ResultsPanel({
  result,
  isStale,
  pending,
  failure,
  onRecalculate,
  onRetry,
  onRetrySchedule,
  headingRef,
  failureRef,
}: ResultsPanelProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={cx(frameStyles.frame, styles.panel)}>
      <FrameCorners />
      <div className={styles.header}>
        {/* Receives focus after a successful calculation. */}
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>
          Your estimate
        </h2>
        <span className={styles.kicker}>Illustrative only</span>
      </div>

      {/* Present before it has content, so changes are announced when they appear. */}
      <div role="status" className={styles.statusRegion}>
        {pending && <p className={styles.pending}>Calculating your estimate…</p>}
        {!pending && result && isStale && (
          <div className={styles.staleBanner}>
            <RefreshCw
              aria-hidden="true"
              size={20}
              strokeWidth={1.5}
              className={styles.staleIcon}
            />
            <div className={styles.staleBody}>
              <p>
                <strong>Your inputs have changed.</strong> The estimate below is out of date.
              </p>
              <Button
                variant="secondary"
                keepFocusOnPress
                onClick={onRecalculate}
                className={styles.recalculate}
              >
                Recalculate estimate
              </Button>
            </div>
          </div>
        )}
      </div>

      {failure && !pending && (
        <div ref={failureRef} tabIndex={-1} role="alert" className={styles.failure}>
          <CircleAlert
            aria-hidden="true"
            size={22}
            strokeWidth={1.5}
            className={styles.failureIcon}
          />
          <div className={styles.failureBody}>
            <p>
              <strong>We couldn't calculate your estimate.</strong> {failure.message}
            </p>
            <Button
              variant="secondary"
              keepFocusOnPress
              onClick={onRetry}
              className={styles.recalculate}
            >
              Try again
            </Button>
          </div>
        </div>
      )}

      {result ? (
        <ResultDetails result={result} isStale={isStale} onRetrySchedule={onRetrySchedule} />
      ) : (
        <div className={styles.empty}>
          <Calculator aria-hidden="true" size={32} strokeWidth={1.5} className={styles.icon} />
          <p className={styles.lead}>
            Enter your details and select <strong>Calculate estimate</strong> to see:
          </p>
          <ul className={styles.list}>
            <li>whether you're estimated to be eligible</li>
            <li>an illustrative approval likelihood and risk category</li>
            <li>a recommended amount, monthly payment and interest rate</li>
            <li>the full repayment schedule</li>
          </ul>
        </div>
      )}

      <AssumptionsDisclosure />
    </section>
  );
}
