import { useId } from 'react';

import { Frame } from '../../components/Frame';
import { cx } from '../../styles/cx';
import styles from './LoanSimulator.module.css';

/**
 * Phase 0 shell: the design's 7/5 grid with the form panel on the left and the
 * estimate panel on the right (stacked below 760px). The panel bodies are
 * temporary placeholders, marked with data-placeholder; the form arrives in
 * Phase 1 and calculation/results in Phase 2 (see docs/PROJECT_PLAN.md).
 */
export function LoanSimulator() {
  const formHeadingId = useId();
  const resultsHeadingId = useId();

  return (
    <div className={styles.layout}>
      <Frame as="section" aria-labelledby={formHeadingId} className={styles.panel}>
        <h2 id={formHeadingId} className={styles.heading}>
          Your details
        </h2>
        <p className={styles.placeholder} data-placeholder="phase-1">
          The details form is not built yet. It is added in Phase 1 of this project.
        </p>
      </Frame>

      <Frame
        as="section"
        aria-labelledby={resultsHeadingId}
        className={cx(styles.panel, styles.results)}
      >
        <div className={styles.resultsHeader}>
          <h2 id={resultsHeadingId} className={styles.heading}>
            Your estimate
          </h2>
          <span className={styles.kicker}>Illustrative only</span>
        </div>
        <p className={styles.placeholder} data-placeholder="phase-2">
          No estimate is calculated yet. Calculation and results are added in Phase 2.
        </p>
      </Frame>
    </div>
  );
}
