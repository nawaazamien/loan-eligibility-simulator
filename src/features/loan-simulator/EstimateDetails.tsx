import { CircleCheck, CircleMinus, TriangleAlert } from 'lucide-react';

import { cx } from '../../styles/cx';
import styles from './EstimateDetails.module.css';
import type { Estimate, Outcome } from './model/calculate';
import { describeEstimate, OUTCOME_NOTE, STALE_NOTE } from './model/copy';

const OUTCOME_ICONS: Record<Outcome, typeof CircleCheck> = {
  within: CircleCheck,
  above: TriangleAlert,
  none: CircleMinus,
};

interface EstimateDetailsProps {
  estimate: Estimate;
  isStale: boolean;
}

/**
 * One calculated estimate, in the design's order: outcome, repayment, explanation,
 * summary, breakdown and next steps. All text comes from describeEstimate(estimate), so
 * nothing here can mix the current form with an older result. The outcome always has an
 * icon and a written title, never colour alone.
 */
export function EstimateDetails({ estimate, isStale }: EstimateDetailsProps) {
  const copy = describeEstimate(estimate);
  const Icon = OUTCOME_ICONS[estimate.outcome];

  return (
    <div className={cx(styles.details, isStale && styles.stale)}>
      <div className={cx(styles.outcome, styles[estimate.outcome])}>
        <Icon aria-hidden="true" size={24} strokeWidth={1.5} className={styles.outcomeIcon} />
        <div className={styles.outcomeText}>
          <p className={styles.outcomeTitle}>{copy.title}</p>
          <p className={styles.outcomeNote}>{isStale ? STALE_NOTE : OUTCOME_NOTE}</p>
        </div>
      </div>

      <div className={styles.figure}>
        <p className={styles.figureLabel}>Estimated monthly repayment</p>
        <p className={styles.figureValue}>{copy.repayment}</p>
        <p className={styles.figureNote}>
          Includes the R69 monthly service fee · 19.5% a year, fixed (fictional)
        </p>
      </div>

      <p className={styles.explanation}>{copy.explanation}</p>

      <dl className={styles.summary}>
        {copy.summary.map(({ term, value }) => (
          <div key={term} className={styles.summaryRow}>
            <dt className={styles.summaryTerm}>{term}</dt>
            <dd className={styles.summaryValue}>{value}</dd>
          </div>
        ))}
      </dl>

      {copy.breakdown && (
        <div className={styles.section}>
          <h3 className={styles.sectionHeading}>{copy.breakdown.heading}</h3>
          <div aria-hidden="true" className={styles.bar}>
            {copy.breakdown.segments.map((segment) => (
              <div
                key={segment.key}
                className={cx(styles.segment, styles[segment.key])}
                style={{ width: `${segment.percent.toFixed(2)}%` }}
              />
            ))}
          </div>
          <ul className={styles.legend}>
            {copy.breakdown.segments.map((segment) => (
              <li key={segment.key} className={styles.legendItem}>
                <span aria-hidden="true" className={cx(styles.swatch, styles[segment.key])} />
                <span>
                  {segment.label} <strong className={styles.legendValue}>{segment.value}</strong>
                </span>
              </li>
            ))}
          </ul>
          {copy.breakdown.shortfall && (
            <p className={styles.shortfall}>{copy.breakdown.shortfall}</p>
          )}
        </div>
      )}

      {copy.tips.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionHeading}>What you could try</h3>
          <ol className={styles.tips}>
            {copy.tips.map((tip, index) => (
              <li key={tip.title} className={styles.tip}>
                <span aria-hidden="true" className={styles.tipNumber}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>
                  <strong>{tip.title}.</strong> {tip.text}
                </span>
              </li>
            ))}
          </ol>
          <p className={styles.footnote}>
            These are illustrations only. Changes don't guarantee you'd qualify for a real loan.
          </p>
        </div>
      )}
    </div>
  );
}
