import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

import { cx } from '../../styles/cx';
import styles from './AssumptionsDisclosure.module.css';

/** Verbatim from the design (HANDOFF §5). Every value here is fictional. */
const ASSUMPTIONS = [
  {
    term: 'Interest rate',
    detail:
      '19.5% a year, fixed for the full term. Interest is calculated monthly on the outstanding balance.',
  },
  {
    term: 'Fees',
    detail: 'A R69 monthly service fee is added to every repayment. No initiation fee is included.',
  },
  {
    term: 'Affordability rule',
    detail:
      'Take-home income minus living expenses and existing debt gives the money you have left. The new repayment may use up to 40% of it.',
  },
  {
    term: 'Outcomes',
    detail:
      'Within the limit, above the limit, or no room when expenses and existing debt use all of your income.',
  },
  {
    term: 'Not considered',
    detail:
      'Credit history, credit insurance, rate changes, employment or any credit bureau information.',
  },
] as const;

/** "How this estimate is calculated": a button with aria-expanded controlling a hidden panel. */
export function AssumptionsDisclosure() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={styles.disclosure}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((wasOpen) => !wasOpen);
        }}
        className={styles.toggle}
      >
        <span>How this estimate is calculated</span>
        <ChevronDown
          aria-hidden="true"
          size={18}
          strokeWidth={1.5}
          className={cx(styles.chevron, open && styles.open)}
        />
      </button>
      <div id={panelId} hidden={!open} className={styles.panel}>
        <dl className={styles.list}>
          {ASSUMPTIONS.map(({ term, detail }) => (
            <div key={term} className={styles.row}>
              <dt className={styles.term}>{term}</dt>
              <dd className={styles.detail}>{detail}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.footnote}>
          All rates, fees and rules are fictional and used for demonstration only.
        </p>
      </div>
    </div>
  );
}
