import type { LoanProduct } from '../../api/contract';
import { money } from './describeResult';
import { Disclosure } from './Disclosure';
import { PURPOSE_LABELS } from './model/fields';
import { formatPercent } from './model/format';
import styles from './ProductInfo.module.css';

interface ProductInfoProps {
  products: readonly LoanProduct[];
  /** The product this page's eligibility check is for. */
  assessedId: string;
}

/**
 * The products the API lists, with their own ranges. The eligibility check is for one of them
 * (its request has no product field); the others are shown for information, and each says
 * so, so nobody mistakes them for something this page assesses.
 */
export function ProductInfo({ products, assessedId }: ProductInfoProps) {
  return (
    <Disclosure title="About our loan products">
      <ul className={styles.list}>
        {products.map((product) => (
          <li key={product.id} className={styles.product}>
            <h3 className={styles.name}>{product.name}</h3>
            <p className={styles.description}>{product.description}</p>
            <dl className={styles.facts}>
              <div>
                <dt>Amount</dt>
                <dd>
                  {money(product.minAmount)} to {money(product.maxAmount)}
                </dd>
              </div>
              <div>
                <dt>Term</dt>
                <dd>
                  {String(product.minTerm)} to {String(product.maxTerm)} months
                </dd>
              </div>
              <div>
                <dt>Interest rate</dt>
                <dd>
                  {formatPercent(product.interestRateRange.min)} to{' '}
                  {formatPercent(product.interestRateRange.max)} a year, by credit score
                </dd>
              </div>
              <div>
                <dt>Purposes</dt>
                <dd>{product.purposes.map((p) => PURPOSE_LABELS[p]).join(', ')}</dd>
              </div>
            </dl>
            <p className={styles.scope}>
              {product.id === assessedId
                ? 'The estimate on this page is for this product.'
                : 'Shown for information: this page estimates the personal loan only.'}
            </p>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}
