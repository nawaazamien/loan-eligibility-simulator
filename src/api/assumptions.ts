/**
 * Project choices that the employer's specification does not make, shared by the app and the
 * mocked API so both reject the same values. Each is listed in docs/requirements/TRACEABILITY.md.
 */

/**
 * The specification gives no maximum for income, expenses or existing debt. Amounts above this
 * are rejected as unrealistic, so neither the screen nor the arithmetic meets absurd figures.
 */
export const MAX_MONEY_RAND = 100_000_000;
