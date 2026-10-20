import { ApiError } from '../../api/client';

/**
 * What to tell the customer when a request fails. The wording says what happened and what to
 * do; the HTTP details stay out of sight. A cancelled request is never shown (callers ignore it).
 */
export function failureMessage(error: unknown, what: string): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'network':
        return `We couldn't reach the loan service to ${what}. Check your connection and try again.`;
      case 'invalid-response':
        return `The loan service sent an answer we couldn't read, so we couldn't ${what}. Try again.`;
      case 'http':
        return error.status !== undefined && error.status >= 500
          ? `The loan service had a problem and we couldn't ${what}. Try again in a moment.`
          : `The loan service couldn't ${what}: ${error.message}`;
      case 'aborted':
        return `The request to ${what} was cancelled.`;
    }
  }
  return `Something went wrong and we couldn't ${what}. Try again.`;
}
