import type { EligibilityRequest, EmploymentStatus, LoanPurpose } from '../../../api/contract';
import type { FormRules, MoneyRule, WholeNumberRule } from '../rules';
import { parseAmount, parseWhole } from './amount';
import { MAX_MONEY_CENTS } from './constants';
import { FIELDS, type Field, type FieldErrors, type FieldValues } from './fields';
import { formatAmountOnBlur, formatCents, formatWholeOnBlur } from './format';

/**
 * Validation, driven by the rules the API returned. Rule violations and empty required
 * fields use the API's own `errorMessage`; text that cannot be read at all gets a plain
 * explanation. Nothing is ever clamped, rounded or defaulted: an invalid entry stays as typed
 * and is reported, and an empty field is never the number zero.
 */
type Check<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

const MALFORMED_MONEY = 'Use numbers only, for example 18 500.';
const MALFORMED_WHOLE = 'Use whole numbers only, for example 35.';
const EMPTY_DEBT = 'Enter your existing monthly debt repayments, or 0 if you have none.';
const EMPTY_PURPOSE = 'Please select a loan purpose.';

function checkMoney(raw: string, rule: MoneyRule, emptyMessage = rule.message): Check<number> {
  const parsed = parseAmount(raw);
  switch (parsed.kind) {
    case 'empty':
      return { ok: false, message: emptyMessage };
    case 'malformed':
      return { ok: false, message: MALFORMED_MONEY };
    case 'negative':
      return {
        ok: false,
        message: rule.minCents > 0 ? rule.message : 'Enter an amount of R0 or more.',
      };
    case 'ok': {
      const { cents } = parsed;
      if (!Number.isSafeInteger(cents) || cents > (rule.maxCents ?? MAX_MONEY_CENTS)) {
        return {
          ok: false,
          message:
            rule.maxCents === undefined
              ? `Enter an amount up to ${formatCents(MAX_MONEY_CENTS)}.`
              : rule.message,
        };
      }
      if (cents < rule.minCents) return { ok: false, message: rule.message };
      return { ok: true, value: cents };
    }
  }
}

function checkWhole(raw: string, rule: WholeNumberRule): Check<number> {
  const parsed = parseWhole(raw);
  switch (parsed.kind) {
    case 'empty':
      return { ok: false, message: rule.message };
    case 'malformed':
      return { ok: false, message: MALFORMED_WHOLE };
    case 'negative':
      return { ok: false, message: rule.message };
    case 'ok':
      if (
        (rule.min !== undefined && parsed.value < rule.min) ||
        (rule.max !== undefined && parsed.value > rule.max)
      ) {
        return { ok: false, message: rule.message };
      }
      return { ok: true, value: parsed.value };
  }
}

/** Existing debt has no entry in the rules; it is required and at least R0 (an assumption). */
function debtRule(): MoneyRule {
  return { minCents: 0, maxCents: undefined, message: EMPTY_DEBT };
}

/** One field on its own, as used when a field is left after a failed submit. */
export function checkField(field: Field, raw: string, rules: FormRules): Check<null> {
  const result = checkValue(field, raw, rules);
  return result.ok ? { ok: true, value: null } : result;
}

function checkValue(
  field: Field,
  raw: string,
  rules: FormRules,
): Check<number | string | undefined> {
  switch (field) {
    case 'age':
      return checkWhole(raw, rules.age);
    case 'employmentDuration':
      return checkWhole(raw, rules.employmentDuration);
    case 'creditScore':
      // Optional: empty is fine and means "not given".
      return raw.trim() === ''
        ? { ok: true, value: undefined }
        : checkWhole(raw, rules.creditScore);
    case 'term':
      return checkWhole(raw, rules.term);
    case 'income':
      return checkMoney(raw, rules.income);
    case 'expenses':
      return checkMoney(raw, rules.expenses);
    case 'debt':
      return checkMoney(raw, debtRule());
    case 'amount':
      return checkMoney(raw, rules.amount);
    case 'employmentStatus':
      return (rules.employmentStatus.options as readonly string[]).includes(raw)
        ? { ok: true, value: raw }
        : { ok: false, message: rules.employmentStatus.message };
    case 'purpose':
      return (rules.purposes as readonly string[]).includes(raw)
        ? { ok: true, value: raw }
        : { ok: false, message: EMPTY_PURPOSE };
  }
}

export type FormCheck =
  | { readonly ok: true; readonly request: EligibilityRequest }
  | { readonly ok: false; readonly errors: FieldErrors };

const toRand = (cents: number) => cents / 100;

/** Validates the whole form. Either a complete request, or every problem at once. */
export function checkForm(values: FieldValues, rules: FormRules): FormCheck {
  const errors: FieldErrors = {};
  const out: Partial<Record<Field, number | string | undefined>> = {};
  for (const field of FIELDS) {
    const result = checkValue(field, values[field], rules);
    if (result.ok) out[field] = result.value;
    else errors[field] = result.message;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const num = (field: Field) => out[field] as number;
  const request: EligibilityRequest = {
    personalInfo: {
      age: num('age'),
      employmentStatus: out.employmentStatus as EmploymentStatus,
      employmentDuration: num('employmentDuration'),
    },
    financialInfo: {
      monthlyIncome: toRand(num('income')),
      monthlyExpenses: toRand(num('expenses')),
      existingDebt: toRand(num('debt')),
      ...(out.creditScore === undefined ? {} : { creditScore: out.creditScore as number }),
    },
    loanDetails: {
      requestedAmount: toRand(num('amount')),
      loanTerm: num('term'),
      loanPurpose: out.purpose as LoanPurpose,
    },
  };
  return { ok: true, request };
}

const MONEY_FIELDS: readonly Field[] = ['income', 'expenses', 'debt', 'amount'];
const WHOLE_FIELDS: readonly Field[] = ['age', 'employmentDuration', 'creditScore', 'term'];

/** Tidies a field when it is left: valid numbers are regrouped; anything else stays as typed. */
export function normalizeOnBlur(field: Field, raw: string): string {
  if (MONEY_FIELDS.includes(field)) return formatAmountOnBlur(raw);
  if (WHOLE_FIELDS.includes(field)) return formatWholeOnBlur(raw);
  return raw;
}

/**
 * A key for the inputs as a calculation sees them. Readable numbers are keyed by their value,
 * so "28500" and "28 500" match; anything else is keyed by its raw text, so it never matches
 * a calculated snapshot. Independent of the rules, so it works before they are loaded.
 */
export function fieldsKey(values: FieldValues): string {
  return FIELDS.map((field) => {
    const raw = values[field];
    if (MONEY_FIELDS.includes(field)) {
      const parsed = parseAmount(raw);
      return parsed.kind === 'ok' ? `m${String(parsed.cents)}` : `x${raw}`;
    }
    if (WHOLE_FIELDS.includes(field)) {
      const parsed = parseWhole(raw);
      return parsed.kind === 'ok'
        ? `n${String(parsed.value)}`
        : raw.trim() === ''
          ? 'n'
          : `x${raw}`;
    }
    return `s${raw}`;
  }).join('|');
}
