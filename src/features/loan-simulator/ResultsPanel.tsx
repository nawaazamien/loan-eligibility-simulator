import { Calculator } from 'lucide-react';
import { useId } from 'react';

import { FrameCorners } from '../../components/Frame';
import frameStyles from '../../components/Frame.module.css';
import { cx } from '../../styles/cx';
import { AssumptionsDisclosure } from './AssumptionsDisclosure';
import styles from './ResultsPanel.module.css';

/**
 * The estimate panel. Phase 1 shows only the design's initial (empty) state and the
 * assumptions; it never shows figures, because nothing has been calculated.
 */
export function ResultsPanel() {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={cx(frameStyles.frame, styles.panel)}>
      <FrameCorners />
      <div className={styles.header}>
        <h2 id={headingId} className={styles.heading}>
          Your estimate
        </h2>
        <span className={styles.kicker}>Illustrative only</span>
      </div>

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

      <AssumptionsDisclosure />
    </section>
  );
}
