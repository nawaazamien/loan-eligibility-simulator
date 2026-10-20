import { http, HttpResponse } from 'msw';

import spec from '../../docs/requirements/LoanEligibilitySimulatorEndpoints.md?raw';
import { server } from '../test/server';
import { ApiError, createApiClient } from './client';
import {
  API_PATHS,
  type CalculateRateRequest,
  type EligibilityRequest,
  type ProductsResponse,
} from './contract';

/**
 * Contract tests: the real API client talking to the mocked endpoints over (intercepted) HTTP.
 * Expected shapes and the products and rules are read from the employer's own file.
 */
const blocks = [...spec.matchAll(/```json\n([\s\S]*?)```/g)].map(
  (match) => JSON.parse(match[1] ?? '') as unknown,
);
const [
  eligibilityRequest,
  eligibilityResponse,
  productsResponse,
  rateRequest,
  rateResponse,
  rulesResponse,
] = blocks;

const client = createApiClient();

/** Same keys and value types, recursively; arrays compare their first element. */
function shapeOf(value: unknown): unknown {
  if (Array.isArray(value)) return [value.length > 0 ? shapeOf(value[0]) : null];
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, shapeOf(v)]));
  }
  return typeof value;
}

describe('the specification file', () => {
  it('has the six JSON examples these tests rely on', () => {
    expect(blocks).toHaveLength(6);
  });
});

describe('GET /api/loans/products', () => {
  it('returns exactly the products in the specification', async () => {
    expect(await client.getProducts()).toEqual(productsResponse);
  });
});

describe('GET /api/loans/validation-rules', () => {
  it('returns exactly the rules in the specification', async () => {
    expect(await client.getValidationRules()).toEqual(rulesResponse);
  });

  it('keeps credit score optional and employment duration required', async () => {
    const rules = await client.getValidationRules();
    expect(rules.financialInfo.creditScore.required).toBe(false);
    expect(rules.personalInfo.employmentDuration).toMatchObject({ required: true, min: 3 });
  });
});

describe('POST /api/loans/eligibility', () => {
  const valid = eligibilityRequest as EligibilityRequest;

  it('answers the specification’s sample request in the specified shape', async () => {
    const response = await client.checkEligibility(valid);
    expect(shapeOf(response)).toEqual(shapeOf(eligibilityResponse));
  });

  it('works without the optional credit score', async () => {
    const financialInfo: EligibilityRequest['financialInfo'] = { ...valid.financialInfo };
    delete financialInfo.creditScore;
    const response = await client.checkEligibility({ ...valid, financialInfo });
    expect(response.recommendedLoan.interestRate).toBe(14.5);
  });

  it('prices a better credit score lower', async () => {
    const rate = async (creditScore: number) =>
      (
        await client.checkEligibility({
          ...valid,
          financialInfo: { ...valid.financialInfo, creditScore },
        })
      ).recommendedLoan.interestRate;
    expect(await rate(800)).toBeLessThan(await rate(650));
    expect(await rate(650)).toBeLessThan(await rate(500));
  });

  it('declines unemployed applicants', async () => {
    const response = await client.checkEligibility({
      ...valid,
      personalInfo: { ...valid.personalInfo, employmentStatus: 'unemployed' },
    });
    expect(response.eligibilityResult.isEligible).toBe(false);
    expect(response.recommendedLoan.recommendedAmount).toBe(0);
  });

  /** One request per rule, each changing a single field of an otherwise valid request. */
  const invalid: [string, (r: EligibilityRequest) => unknown, string, string][] = [
    [
      'age below 18',
      (r) => ({ ...r, personalInfo: { ...r.personalInfo, age: 17 } }),
      'personalInfo.age',
      'Age must be between 18 and 65',
    ],
    [
      'age above 65',
      (r) => ({ ...r, personalInfo: { ...r.personalInfo, age: 66 } }),
      'personalInfo.age',
      'Age must be between 18 and 65',
    ],
    [
      'fractional age',
      (r) => ({ ...r, personalInfo: { ...r.personalInfo, age: 35.5 } }),
      'personalInfo.age',
      'Age must be between 18 and 65',
    ],
    [
      'unknown employment status',
      (r) => ({ ...r, personalInfo: { ...r.personalInfo, employmentStatus: 'astronaut' } }),
      'personalInfo.employmentStatus',
      'Please select your employment status',
    ],
    [
      'employment under 3 months',
      (r) => ({ ...r, personalInfo: { ...r.personalInfo, employmentDuration: 2 } }),
      'personalInfo.employmentDuration',
      'Minimum 3 months employment required',
    ],
    [
      'income below R5 000',
      (r) => ({ ...r, financialInfo: { ...r.financialInfo, monthlyIncome: 4999.99 } }),
      'financialInfo.monthlyIncome',
      'Minimum monthly income of R5,000 required',
    ],
    [
      'negative expenses',
      (r) => ({ ...r, financialInfo: { ...r.financialInfo, monthlyExpenses: -1 } }),
      'financialInfo.monthlyExpenses',
      'Please enter your monthly expenses',
    ],
    [
      'negative debt',
      (r) => ({ ...r, financialInfo: { ...r.financialInfo, existingDebt: -1 } }),
      'financialInfo.existingDebt',
      'Please enter your existing monthly debt repayments',
    ],
    [
      'credit score below 300',
      (r) => ({ ...r, financialInfo: { ...r.financialInfo, creditScore: 299 } }),
      'financialInfo.creditScore',
      'Credit score must be between 300 and 850',
    ],
    [
      'credit score above 850',
      (r) => ({ ...r, financialInfo: { ...r.financialInfo, creditScore: 851 } }),
      'financialInfo.creditScore',
      'Credit score must be between 300 and 850',
    ],
    [
      'amount below R5 000',
      (r) => ({ ...r, loanDetails: { ...r.loanDetails, requestedAmount: 4999.99 } }),
      'loanDetails.requestedAmount',
      'Loan amount must be between R5,000 and R300,000',
    ],
    [
      'amount above R300 000',
      (r) => ({ ...r, loanDetails: { ...r.loanDetails, requestedAmount: 300000.01 } }),
      'loanDetails.requestedAmount',
      'Loan amount must be between R5,000 and R300,000',
    ],
    [
      'amount with a fraction of a cent',
      (r) => ({ ...r, loanDetails: { ...r.loanDetails, requestedAmount: 5000.005 } }),
      'loanDetails.requestedAmount',
      'Loan amount must be between R5,000 and R300,000',
    ],
    [
      'term below 6',
      (r) => ({ ...r, loanDetails: { ...r.loanDetails, loanTerm: 5 } }),
      'loanDetails.loanTerm',
      'Loan term must be between 6 and 60 months',
    ],
    [
      'term above 60',
      (r) => ({ ...r, loanDetails: { ...r.loanDetails, loanTerm: 61 } }),
      'loanDetails.loanTerm',
      'Loan term must be between 6 and 60 months',
    ],
    [
      'a vehicle purpose (the eligibility check is for personal loans)',
      (r) => ({ ...r, loanDetails: { ...r.loanDetails, loanPurpose: 'new_vehicle' } }),
      'loanDetails.loanPurpose',
      'Please select a personal-loan purpose',
    ],
    [
      'income as text',
      (r) => ({ ...r, financialInfo: { ...r.financialInfo, monthlyIncome: '25000' } }),
      'financialInfo.monthlyIncome',
      'Minimum monthly income of R5,000 required',
    ],
  ];

  it.each(invalid)('rejects %s with a field error', async (_name, change, path, message) => {
    const error = await client
      .checkEligibility(change(valid) as EligibilityRequest)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    if (!(error instanceof ApiError)) return;
    expect(error.kind).toBe('http');
    expect(error.status).toBe(400);
    expect(error.body?.error.code).toBe('VALIDATION_ERROR');
    expect(error.fieldErrors.get(path)).toBe(message);
  });

  it('accepts every value at the limits', async () => {
    for (const change of [
      { personalInfo: { ...valid.personalInfo, age: 18 } },
      { personalInfo: { ...valid.personalInfo, age: 65 } },
      { personalInfo: { ...valid.personalInfo, employmentDuration: 3 } },
      {
        financialInfo: {
          ...valid.financialInfo,
          monthlyIncome: 5000,
          monthlyExpenses: 0,
          existingDebt: 0,
        },
      },
      { financialInfo: { ...valid.financialInfo, creditScore: 300 } },
      { financialInfo: { ...valid.financialInfo, creditScore: 850 } },
      { loanDetails: { ...valid.loanDetails, requestedAmount: 5000, loanTerm: 6 } },
      { loanDetails: { ...valid.loanDetails, requestedAmount: 300000, loanTerm: 60 } },
    ]) {
      await expect(client.checkEligibility({ ...valid, ...change })).resolves.toBeDefined();
    }
  });

  it('reports every invalid field at once', async () => {
    const bad = {
      ...valid,
      personalInfo: { ...valid.personalInfo, age: 10 },
      loanDetails: { ...valid.loanDetails, loanTerm: 99 },
    };
    const error = await client.checkEligibility(bad).catch((e: unknown) => e);
    expect(error instanceof ApiError && [...error.fieldErrors.keys()]).toEqual([
      'personalInfo.age',
      'loanDetails.loanTerm',
    ]);
  });

  it('answers a body that is not JSON with a validation error, not a crash', async () => {
    const response = await fetch(new URL(API_PATHS.eligibility, window.location.origin), {
      method: 'POST',
      body: 'nope',
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR',
    );
  });
});

describe('POST /api/loans/calculate-rate', () => {
  const valid = rateRequest as CalculateRateRequest;

  it('answers the specification’s sample request in the specified shape', async () => {
    const response = await client.calculateRate(valid);
    expect(shapeOf(response)).toEqual(shapeOf(rateResponse));
  });

  it('returns the complete schedule, not just two rows', async () => {
    const response = await client.calculateRate(valid);
    expect(response.paymentSchedule).toHaveLength(24);
    expect(response.paymentSchedule.map((row) => row.month)).toEqual(
      Array.from({ length: 24 }, (_, i) => i + 1),
    );
    expect(response.paymentSchedule.at(-1)?.balance).toBe(0);
  });

  it('uses the verified formula, which differs from the specification’s sample figures', async () => {
    // The specification shows 7089.50 for R150 000 over 24 months at 12.5%; the true level
    // payment is 7096.10 (docs/validation/phase-6/verify_reference.py). We implement the formula.
    const response = await client.calculateRate(valid);
    expect(response).toMatchObject({
      interestRate: 12.5,
      monthlyPayment: 7096.1,
      totalInterest: 20306.3,
      totalRepayment: 170306.3,
    });
    expect(response.paymentSchedule[0]).toEqual({
      month: 1,
      payment: 7096.1,
      principal: 5533.6,
      interest: 1562.5,
      balance: 144466.4,
    });
    expect(response.paymentSchedule.at(-1)).toEqual({
      month: 24,
      payment: 7096.0,
      principal: 7022.85,
      interest: 73.15,
      balance: 0,
    });
  });

  it('works without the optional credit score', async () => {
    const request: CalculateRateRequest = { ...valid };
    delete request.creditScore;
    expect((await client.calculateRate(request)).interestRate).toBe(14.5);
  });

  it('uses each product’s own limits and rates', async () => {
    const vehicle = await client.calculateRate({
      loanAmount: 50000,
      loanTerm: 12,
      creditScore: 650,
      loanType: 'vehicle_loan',
    });
    expect(vehicle.interestRate).toBe(10.13);
    expect(vehicle.paymentSchedule).toHaveLength(12);
    // R50 000 is below the personal-loan limit of R300 000 but allowed; R40 000 is below the vehicle minimum.
    await expect(
      client.calculateRate({ loanAmount: 40000, loanTerm: 12, loanType: 'vehicle_loan' }),
    ).rejects.toMatchObject({ kind: 'http', status: 400 });
    await expect(
      client.calculateRate({ loanAmount: 400000, loanTerm: 24, loanType: 'personal_loan' }),
    ).rejects.toMatchObject({ kind: 'http', status: 400 });
    await expect(
      client.calculateRate({ loanAmount: 100000, loanTerm: 72, loanType: 'vehicle_loan' }),
    ).resolves.toBeDefined();
    await expect(
      client.calculateRate({ loanAmount: 100000, loanTerm: 72, loanType: 'personal_loan' }),
    ).rejects.toMatchObject({ kind: 'http', status: 400 });
  });

  it('rejects an unknown loan type as unsupported', async () => {
    const error = await client
      .calculateRate({ ...valid, loanType: 'boat_loan' as never })
      .catch((e: unknown) => e);
    expect(error instanceof ApiError && error.body?.error.code).toBe('UNSUPPORTED_PRODUCT');
  });

  it('rejects a credit score outside 300–850', async () => {
    await expect(client.calculateRate({ ...valid, creditScore: 900 })).rejects.toMatchObject({
      kind: 'http',
      status: 400,
    });
  });
});

describe('unknown endpoints', () => {
  it('answer with the documented error shape instead of falling through', async () => {
    const response = await fetch(new URL('/api/loans/unknown', window.location.origin));
    expect(response.status).toBe(404);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });
});

describe('the client reports failures as ApiError', () => {
  it('when the network fails', async () => {
    server.use(http.get(API_PATHS.products, () => HttpResponse.error()));
    await expect(client.getProducts()).rejects.toMatchObject({ kind: 'network' });
  });

  it('when the server answers an error, keeping the documented body', async () => {
    server.use(
      http.get(API_PATHS.products, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Down for maintenance.' } },
          { status: 503 },
        ),
      ),
    );
    await expect(client.getProducts()).rejects.toMatchObject({
      kind: 'http',
      status: 503,
      message: 'Down for maintenance.',
    });
  });

  it('when the error has no documented body', async () => {
    server.use(
      http.get(API_PATHS.products, () => new HttpResponse('Bad gateway', { status: 502 })),
    );
    await expect(client.getProducts()).rejects.toMatchObject({ kind: 'http', status: 502 });
  });

  it('when a success response is not the promised shape', async () => {
    server.use(http.get(API_PATHS.products, () => HttpResponse.json({ products: 'many' })));
    await expect(client.getProducts()).rejects.toMatchObject({ kind: 'invalid-response' });
    server.use(
      http.post(API_PATHS.eligibility, () => HttpResponse.json({ eligibilityResult: {} })),
    );
    await expect(
      client.checkEligibility(eligibilityRequest as EligibilityRequest),
    ).rejects.toMatchObject({ kind: 'invalid-response' });
  });

  it('when the caller cancels', async () => {
    const controller = new AbortController();
    const pending = client.getProducts(controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  });

  it('uses a configured base URL instead of the page origin', async () => {
    const seen: string[] = [];
    server.use(
      http.get('https://api.example.test/api/loans/products', ({ request }) => {
        seen.push(request.url);
        return HttpResponse.json(productsResponse as ProductsResponse);
      }),
    );
    await createApiClient({ baseUrl: 'https://api.example.test' }).getProducts();
    expect(seen).toEqual(['https://api.example.test/api/loans/products']);
  });
});
