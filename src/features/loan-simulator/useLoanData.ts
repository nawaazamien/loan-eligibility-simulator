import { useCallback, useEffect, useState } from 'react';

import { ApiError, type ApiClient } from '../../api/client';
import { failureMessage } from './failureMessage';
import { buildFormRules, type FormRules } from './rules';

export type LoanData =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly rules: FormRules };

/**
 * Loads the validation rules and the products through the API client, once, and again when
 * the customer retries after a failure. Leaving the page cancels the requests.
 */
export function useLoanData(client: ApiClient): { data: LoanData; retry: () => void } {
  const [data, setData] = useState<LoanData>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      client.getValidationRules(controller.signal),
      client.getProducts(controller.signal),
    ]).then(
      ([rules, products]) => {
        const built = buildFormRules(rules, products);
        setData(
          built
            ? { status: 'ready', rules: built }
            : {
                status: 'error',
                message:
                  "The loan service didn't list the loan product this check is for. Try again.",
              },
        );
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.kind === 'aborted') return;
        setData({ status: 'error', message: failureMessage(error, 'load the loan details') });
      },
    );
    return () => {
      controller.abort();
    };
  }, [client, attempt]);

  const retry = useCallback(() => {
    setData({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { data, retry };
}
