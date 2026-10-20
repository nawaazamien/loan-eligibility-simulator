import { useId } from 'react';

import type { CalculateRateResponse } from '../../api/contract';
import { formatPercent } from './model/format';
import { money, moneyExact } from './describeResult';
import styles from './ScheduleTable.module.css';

interface ScheduleTableProps {
  rate: CalculateRateResponse;
  /** The amount the schedule is for (the request's `loanAmount`). */
  amount: number;
  term: number;
}

/**
 * The complete repayment schedule from calculate-rate: every month, not a sample. The wide
 * table scrolls sideways inside its own focusable region on narrow screens, so the page never
 * scrolls sideways. The footer shows the response's own totals; nothing is added up here.
 */
export function ScheduleTable({ rate, amount, term }: ScheduleTableProps) {
  const captionId = useId();
  return (
    <div
      role="region"
      aria-labelledby={captionId}
      // A scrollable region must be reachable by keyboard.
      tabIndex={0}
      className={styles.scroller}
    >
      <table className={styles.table}>
        <caption id={captionId} className={styles.caption}>
          Repayment schedule for {money(amount)} over {String(term)} months at{' '}
          {formatPercent(rate.interestRate)} a year
        </caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Payment</th>
            <th scope="col">Principal</th>
            <th scope="col">Interest</th>
            <th scope="col">Remaining balance</th>
          </tr>
        </thead>
        <tbody>
          {rate.paymentSchedule.map((row) => (
            <tr key={row.month}>
              <th scope="row">{row.month}</th>
              <td>{moneyExact(row.payment)}</td>
              <td>{moneyExact(row.principal)}</td>
              <td>{moneyExact(row.interest)}</td>
              <td>{moneyExact(row.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td>{moneyExact(rate.totalRepayment)}</td>
            <td>{moneyExact(amount)}</td>
            <td>{moneyExact(rate.totalInterest)}</td>
            <td aria-label="No balance remains">{moneyExact(0)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
