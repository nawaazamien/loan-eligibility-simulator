import {
  API_PATHS,
  type ApiErrorBody,
  type CalculateRateRequest,
  type CalculateRateResponse,
  type EligibilityRequest,
  type EligibilityResponse,
  type ProductsResponse,
  type ValidationRulesResponse,
} from './contract';
import {
  isApiErrorBody,
  isCalculateRateResponse,
  isEligibilityResponse,
  isProductsResponse,
  isValidationRulesResponse,
} from './guards';

/**
 * How a request failed:
 * - `network`: no response (offline, blocked, or the mock was not running);
 * - `http`: the server answered with an error status (see `body` for the documented shape);
 * - `invalid-response`: a success status, but not the shape the contract promises;
 * - `aborted`: the caller cancelled it (never shown to the customer).
 */
export class ApiError extends Error {
  constructor(
    readonly kind: 'network' | 'http' | 'invalid-response' | 'aborted',
    message: string,
    readonly status?: number,
    readonly body?: ApiErrorBody,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Per-field messages from a VALIDATION_ERROR, keyed by dotted request path. */
  get fieldErrors(): ReadonlyMap<string, string> {
    return new Map((this.body?.error.fields ?? []).map((f) => [f.path, f.message]));
  }
}

export interface ApiClient {
  getProducts(signal?: AbortSignal): Promise<ProductsResponse>;
  getValidationRules(signal?: AbortSignal): Promise<ValidationRulesResponse>;
  checkEligibility(request: EligibilityRequest, signal?: AbortSignal): Promise<EligibilityResponse>;
  calculateRate(
    request: CalculateRateRequest,
    signal?: AbortSignal,
  ): Promise<CalculateRateResponse>;
}

export interface ApiClientOptions {
  /**
   * Where the API lives. Empty (the default) means the page's own origin, which is where the
   * in-browser mock answers. Set it (build-time `VITE_API_BASE_URL`) to use a real API.
   */
  baseUrl?: string;
  /** For tests. Defaults to the global fetch. */
  fetch?: typeof fetch;
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));

  async function call<T>(
    method: 'GET' | 'POST',
    path: string,
    guard: (body: unknown) => body is T,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    // Absolute URLs work the same in the browser, the jsdom tests and Node.
    const base = options.baseUrl ? options.baseUrl : window.location.origin;
    const url = new URL(path, base);
    let response: Response;
    try {
      response = await doFetch(url, {
        method,
        headers:
          body === undefined
            ? { accept: 'application/json' }
            : { accept: 'application/json', 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw new ApiError('aborted', 'The request was cancelled.');
      }
      throw new ApiError('network', 'The loan service could not be reached.');
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      json = undefined;
    }

    if (!response.ok) {
      const errorBody = isApiErrorBody(json) ? json : undefined;
      throw new ApiError(
        'http',
        errorBody?.error.message ?? `The loan service answered ${String(response.status)}.`,
        response.status,
        errorBody,
      );
    }
    if (!guard(json)) {
      throw new ApiError(
        'invalid-response',
        'The loan service sent an unexpected response.',
        response.status,
      );
    }
    return json;
  }

  return {
    getProducts: (signal) => call('GET', API_PATHS.products, isProductsResponse, undefined, signal),
    getValidationRules: (signal) =>
      call('GET', API_PATHS.validationRules, isValidationRulesResponse, undefined, signal),
    checkEligibility: (request, signal) =>
      call('POST', API_PATHS.eligibility, isEligibilityResponse, request, signal),
    calculateRate: (request, signal) =>
      call('POST', API_PATHS.calculateRate, isCalculateRateResponse, request, signal),
  };
}
