import { CircleCheck, CircleMinus, TriangleAlert } from 'lucide-react';

import { Button } from '../../components/Button';
import { cx } from '../../styles/cx';
import { Disclosure } from './Disclosure';
import {
  AFFORDABILITY_LABELS,
  describeResult,
  LIKELIHOOD_DISCLAIMER,
  money,
  OUTCOME_NOTE,
  STALE_NOTE,
  type OutcomeKind,
} from './describeResult';
import type { CalculatedResult } from './formState';
import { formatPercent } from './model/format';
import { ScheduleTable } from './ScheduleTable';
import styles from './ResultDetails.module.css';

const OUTCOME_ICONS: Record<OutcomeKind, typeof CircleCheck> = {
  full: CircleCheck,
  reduced: TriangleAlert,
  none: CircleMinus,
};

interface ResultDetailsProps {
  result: CalculatedResult;
  isStale: boolean;
  onRetrySchedule: () => void;
}

/**
 * One calculation, in order: outcome, headline payment, likelihood, key figures, then the
 * supporting detail in disclosures. Every figure comes from the same stored snapshot
 * (eligibility and schedule responses to one submission), never from the live form. The outcome
 * always has an icon and a written title, never colour alone.
 */
export function ResultDetails({ result, isStale, onRetrySchedule }: ResultDetailsProps) {
  const summary = describeResult(result);
  const Icon = OUTCOME_ICONS[summary.kind];
  const { eligibility, request, schedule, scheduleRequest } = result;
  const { affordabilityAnalysis: analysis, recommendedLoan: loan } = eligibility;

  return (
    <div className={cx(styles.details, isStale && styles.stale)}>
      <div className={cx(styles.outcome, styles[summary.kind])}>
        <Icon aria-hidden="true" size={24} strokeWidth={1.5} className={styles.outcomeIcon} />
        <div className={styles.outcomeText}>
          <p className={styles.outcomeTitle}>{summary.title}</p>
          <p className={styles.outcomeNote}>{isStale ? STALE_NOTE : OUTCOME_NOTE}</p>
        </div>
      </div>

      <p className={styles.explanation}>{summary.reason}</p>

      {summary.payment ? (
        <div className={styles.figure}>
          <p className={styles.figureLabel}>Estimated monthly payment</p>
          <p className={styles.figureValue}>{summary.payment}</p>
          <p className={styles.figureNote}>
            For {money(loan.recommendedAmount)} over {String(request.loanDetails.loanTerm)} months
            at {formatPercent(loan.interestRate)} a year (fictional)
          </p>
        </div>
      ) : (
        <p className={styles.noFigure}>No loan amount fits these figures in this demo.</p>
      )}

      <div className={styles.likelihood}>
        <p className={styles.likelihoodLine}>
          Illustrative approval likelihood <strong>{summary.likelihood}</strong> · Risk category{' '}
          <strong>{summary.risk}</strong>
        </p>
        <p className={styles.disclaimer}>{LIKELIHOOD_DISCLAIMER}</p>
      </div>

      <dl className={styles.summary}>
        {summary.rows.map(({ term, value }) => (
          <div key={term} className={styles.summaryRow}>
            <dt className={styles.summaryTerm}>{term}</dt>
            <dd className={styles.summaryValue}>{value}</dd>
          </div>
        ))}
      </dl>

      <Disclosure title="Affordability details">
        <dl className={styles.detailList}>
          <div className={styles.detailRow}>
            <dt className={styles.detailTerm}>Disposable income</dt>
            <dd className={styles.detailValue}>{money(analysis.disposableIncome)} a month</dd>
            <dd className={styles.detailNote}>
              Monthly income minus monthly expenses, before existing debt repayments.
            </dd>
          </div>
          <div className={styles.detailRow}>
            <dt className={styles.detailTerm}>Debt-to-income ratio</dt>
            <dd className={styles.detailValue}>{formatPercent(analysis.debtToIncomeRatio)}</dd>
            <dd className={styles.detailNote}>
              Existing monthly debt repayments as a share of monthly income.
            </dd>
          </div>
          <div className={styles.detailRow}>
            <dt className={styles.detailTerm}>Loan-to-income ratio</dt>
            <dd className={styles.detailValue}>{formatPercent(analysis.loanToIncomeRatio)}</dd>
            <dd className={styles.detailNote}>
              Requested amount as a share of annual income (12 × monthly income). The employer's
              specification gives no formula; this is this demo's assumption.
            </dd>
          </div>
          <div className={styles.detailRow}>
            <dt className={styles.detailTerm}>Affordability score</dt>
            <dd className={styles.detailValue}>
              {AFFORDABILITY_LABELS[analysis.affordabilityScore]}
            </dd>
            <dd className={styles.detailNote}>
              How the estimated payment for the requested amount compares with what is left each
              month after expenses and existing debt.
            </dd>
          </div>
        </dl>
      </Disclosure>

      {schedule.status === 'loading' && (
        <p role="status" className={styles.disclaimer}>
          Loading the repayment schedule…
        </p>
      )}
      {schedule.status === 'failed' && (
        <div className={styles.scheduleNote}>
          <p role="alert">{schedule.message}</p>
          <Button variant="secondary" keepFocusOnPress onClick={onRetrySchedule}>
            Retry schedule
          </Button>
        </div>
      )}
      {schedule.status === 'ready' && (
        <Disclosure title={`Repayment schedule (${String(request.loanDetails.loanTerm)} months)`}>
          <p className={styles.scheduleFor}>
            {summary.kind === 'none'
              ? `For your requested amount of ${money(scheduleRequest.loanAmount)}, which this demo does not recommend.`
              : `For the recommended amount of ${money(scheduleRequest.loanAmount)}.`}
          </p>
          <ScheduleTable
            rate={schedule.rate}
            amount={scheduleRequest.loanAmount}
            term={request.loanDetails.loanTerm}
          />
        </Disclosure>
      )}
    </div>
  );
}
