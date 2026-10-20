import { delay, http, HttpResponse } from 'msw';

import {
  API_PATHS,
  type ApiErrorBody,
  type CalculateRateResponse,
  type EligibilityResponse,
  type ProductsResponse,
  type ValidationRulesResponse,
} from '../api/contract';
import { ELIGIBILITY_PRODUCT_ID, findProduct, PRODUCTS, VALIDATION_RULES } from './catalogue';
import { assessEligibility } from './eligibility';
import { annualRateBasisPoints, buildSchedule, centsToRand, randToCents } from './pricing';
import { validateEligibilityRequest, validateRateRequest } from './requestValidation';

/**
 * The mocked HTTP API: the employer's four endpoints, served in the browser by Mock Service
 * Worker and in tests by msw/node. A short fixed delay models a network round trip; tests
 * set it to 0.
 */
export const mockSettings = { latencyMs: 350 };

function errorResponse(status: number, body: ApiErrorBody) {
  return HttpResponse.json(body, { status });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export const handlers = [
  http.get(API_PATHS.products, async () => {
    await delay(mockSettings.latencyMs);
    return HttpResponse.json<ProductsResponse>({ products: [...PRODUCTS] });
  }),

  http.get(API_PATHS.validationRules, async () => {
    await delay(mockSettings.latencyMs);
    return HttpResponse.json<ValidationRulesResponse>(VALIDATION_RULES);
  }),

  http.post(API_PATHS.eligibility, async ({ request }) => {
    await delay(mockSettings.latencyMs);
    const checked = validateEligibilityRequest(await readJson(request));
    if (!checked.ok) {
      return errorResponse(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Some details are missing or invalid.',
          fields: checked.errors,
        },
      });
    }
    const product = findProduct(ELIGIBILITY_PRODUCT_ID);
    if (!product) {
      return errorResponse(500, {
        error: { code: 'INTERNAL_ERROR', message: 'The loan product is unavailable.' },
      });
    }
    return HttpResponse.json<EligibilityResponse>(assessEligibility(checked.value, product));
  }),

  http.post(API_PATHS.calculateRate, async ({ request }) => {
    await delay(mockSettings.latencyMs);
    const checked = validateRateRequest(await readJson(request));
    if (!checked.ok) {
      if ('unsupported' in checked) {
        return errorResponse(400, {
          error: { code: 'UNSUPPORTED_PRODUCT', message: 'Unknown loan type.' },
        });
      }
      return errorResponse(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Some details are missing or invalid.',
          fields: checked.errors,
        },
      });
    }
    const { loanAmount, loanTerm, creditScore, loanType } = checked.value;
    const product = findProduct(loanType);
    if (!product) {
      return errorResponse(400, {
        error: { code: 'UNSUPPORTED_PRODUCT', message: 'Unknown loan type.' },
      });
    }
    const rateBp = annualRateBasisPoints(product, creditScore);
    const schedule = buildSchedule(randToCents(loanAmount), loanTerm, rateBp);
    return HttpResponse.json<CalculateRateResponse>({
      interestRate: rateBp / 100,
      monthlyPayment: centsToRand(schedule.levelPayment),
      totalInterest: centsToRand(schedule.totalInterest),
      totalRepayment: centsToRand(schedule.totalRepayment),
      paymentSchedule: schedule.rows.map((row) => ({
        month: row.month,
        payment: centsToRand(row.payment),
        principal: centsToRand(row.principal),
        interest: centsToRand(row.interest),
        balance: centsToRand(row.balance),
      })),
    });
  }),

  // Anything else under /api is an unknown endpoint: answer with the documented error shape
  // rather than letting the request fall through to the real host.
  http.all('/api/*', () =>
    errorResponse(404, { error: { code: 'NOT_FOUND', message: 'No such endpoint.' } }),
  ),
];
