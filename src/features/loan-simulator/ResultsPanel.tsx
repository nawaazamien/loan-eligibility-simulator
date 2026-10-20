import { Calculator, RefreshCw } from 'lucide-react';
import { useId, type Ref } from 'react';

import { Button } from '../../components/Button';
import { FrameCorners } from '../../components/Frame';
import frameStyles from '../../components/Frame.module.css';
import { cx } from '../../styles/cx';
import { AssumptionsDisclosure } from './AssumptionsDisclosure';
import { EstimateDetails } from './EstimateDetails';
import type { CalculatedResult } from './formState';
import styles from './ResultsPanel.module.css';

interface ResultsPanelProps {
  result: CalculatedResult | null;
  isStale: boolean;
  onRecalculate: () => void;
  headingRef: Ref<HTMLHeadingElement>;
}

/**
 * The estimate panel: the initial explanation until a calculation succeeds, then the last
 * successful estimate. When the inputs change afterwards, that estimate stays visible but
 * is marked out of date until it is recalculated or the form is reset.
 */
export function ResultsPanel({ result, isStale, onRecalculate, headingRef }: ResultsPanelProps) {
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

      {result ? (
        <div className={styles.result}>
          {/* Present before it has content, so the change is announced when it appears. */}
          <div role="status">
            {isStale && (
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
          <EstimateDetails estimate={result.estimate} isStale={isStale} />
        </div>
      ) : (
        <div className={styles.empty}>
          <Calculator aria-hidden="true" size={32} strokeWidth={1.5} className={styles.icon} />
          <p className={styles.lead}>
            Enter your details and select <strong>Calculate estimate</strong> to see:
          </p>
          <ul className={styles.list}>
            <li>your estimated monthly repayment</li>
            <li>what you'd have left each month</li>
            <li>whether it fits the demo affordability limit</li>
            <li>what you could change to improve it</li>
          </ul>
        </div>
      )}

      <AssumptionsDisclosure />
    </section>
  );
}
