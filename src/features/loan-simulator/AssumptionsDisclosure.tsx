import { Disclosure } from './Disclosure';
import styles from './AssumptionsDisclosure.module.css';

/**
 * "How this estimate is made". The employer's specification defines the API's fields but not
 * how an estimate is decided, so these rules are this demo's own fictional assumptions
 * (docs/SIMULATION_MODEL.md). They are not the employer's rules or any lender's policy.
 */
const ASSUMPTIONS = [
  {
    term: 'Interest rate',
    detail:
      "Within the product's published range, set by credit score: a better score gets a lower rate. With no score given, the middle of the range applies. The rate is fixed for the term and charged monthly on the outstanding balance.",
  },
  {
    term: 'What you can afford',
    detail:
      'Monthly income minus expenses and existing debt repayments is what you have left. The new monthly payment may use up to 40% of it. The maximum amount is the largest R1 000 step that fits.',
  },
  {
    term: 'Employment',
    detail:
      'Unemployed applicants are not assessed. A longer time in employment slightly improves the likelihood.',
  },
  {
    term: 'Likelihood and risk',
    detail:
      'The approval likelihood is a simple score from your credit score, how comfortably the payment fits and your employment. Risk is low, medium or high from that likelihood.',
  },
  {
    term: 'Not considered',
    detail:
      'Credit history, credit insurance, fees, rate changes, or any credit bureau information.',
  },
] as const;

export function AssumptionsDisclosure() {
  return (
    <Disclosure title="How this estimate is made">
      <dl className={styles.list}>
        {ASSUMPTIONS.map(({ term, detail }) => (
          <div key={term} className={styles.row}>
            <dt className={styles.term}>{term}</dt>
            <dd className={styles.detail}>{detail}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.footnote}>
        All rates, rules and results here are fictional and used for demonstration only. They are
        not a real lender's policy and not the employer's rules.
      </p>
    </Disclosure>
  );
}
