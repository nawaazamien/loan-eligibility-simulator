import { useEffect, type Dispatch } from 'react';

import { ApiError, type ApiClient } from '../../api/client';
import { failureMessage } from './failureMessage';
import type { FormAction, FormState } from './formState';
import { FIELDS, REQUEST_PATHS, type FieldErrors } from './model/fields';

/** Field errors a real API reports against request paths, mapped back onto the form's fields. */
function fieldErrorsFrom(error: ApiError): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of FIELDS) {
    const message = error.fieldErrors.get(REQUEST_PATHS[field]);
    if (message) errors[field] = message;
  }
  return errors;
}

/**
 * Performs the requests the reducer asks for. The reducer owns what each request means and
 * which answers still count; this only fetches and reports. Each request is cancelled when it
 * is superseded or the form is reset, and anything that still arrives late is ignored by id.
 */
export function useCalculation(
  client: ApiClient,
  state: FormState,
  dispatch: Dispatch<FormAction>,
): void {
  const { pending } = state;
  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    client.checkEligibility(pending.request, controller.signal).then(
      (eligibility) => {
        dispatch({ type: 'eligibilityLoaded', id: pending.id, eligibility });
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.kind === 'aborted') return;
        const errors = error instanceof ApiError ? fieldErrorsFrom(error) : {};
        if (Object.keys(errors).length > 0) {
          dispatch({ type: 'calculationRejected', id: pending.id, errors });
          return;
        }
        dispatch({
          type: 'calculationFailed',
          id: pending.id,
          message: failureMessage(error, 'calculate your estimate'),
        });
      },
    );
    return () => {
      controller.abort();
    };
  }, [client, pending, dispatch]);

  const { result } = state;
  const loading = result?.schedule.status === 'loading';
  const calculation = result?.calculation;
  const run = result?.scheduleRun;
  const scheduleRequest = result?.scheduleRequest;
  useEffect(() => {
    if (!loading || calculation === undefined || run === undefined || !scheduleRequest) return;
    const controller = new AbortController();
    client.calculateRate(scheduleRequest, controller.signal).then(
      (rate) => {
        dispatch({ type: 'scheduleLoaded', calculation, run, rate });
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.kind === 'aborted') return;
        dispatch({
          type: 'scheduleFailed',
          calculation,
          run,
          message: failureMessage(error, 'load the repayment schedule'),
        });
      },
    );
    return () => {
      controller.abort();
    };
  }, [client, loading, calculation, run, scheduleRequest, dispatch]);
}
