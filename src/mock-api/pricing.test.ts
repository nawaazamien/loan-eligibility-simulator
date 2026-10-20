import { PRODUCTS } from './catalogue';
import {
  annualRateBasisPoints,
  buildSchedule,
  centsToRand,
  levelPaymentCents,
  randToCents,
  rangePositionInEighths,
  roundHalfUp,
} from './pricing';

/**
 * Reference values come from docs/validation/phase-6/verify_reference.py, which re-derives
 * every figure with 50-digit decimal arithmetic and shares no code with the implementation.
 */
const personal = PRODUCTS[0];
const vehicle = PRODUCTS[1];
if (!personal || !vehicle) throw new Error('Expected two products');

describe('annualRateBasisPoints', () => {
  it.each([
    [undefined, 1450, 1175],
    [850, 1050, 850],
    [750, 1050, 850],
    [720, 1150, 931],
    [650, 1250, 1013],
    [620, 1450, 1175],
    [570, 1650, 1338],
    [400, 1850, 1500],
  ])('credit score %s → personal %d bp, vehicle %d bp', (score, personalBp, vehicleBp) => {
    expect(annualRateBasisPoints(personal, score)).toBe(personalBp);
    expect(annualRateBasisPoints(vehicle, score)).toBe(vehicleBp);
  });

  it('gives the specification’s example rate of 12.5% for a personal loan at score 650', () => {
    expect(annualRateBasisPoints(personal, 650) / 100).toBe(12.5);
  });

  it('rounds half-up to a whole basis point (vehicle at 650 is 1012.5 → 1013)', () => {
    expect(annualRateBasisPoints(vehicle, 650)).toBe(1013);
  });

  it('keeps every rate inside the product’s published range', () => {
    for (const product of PRODUCTS) {
      for (const score of [undefined, 300, 549, 550, 599, 600, 649, 650, 699, 700, 749, 750, 850]) {
        const rate = annualRateBasisPoints(product, score) / 100;
        expect(rate).toBeGreaterThanOrEqual(product.interestRateRange.min);
        expect(rate).toBeLessThanOrEqual(product.interestRateRange.max);
      }
    }
  });

  it('gets cheaper as the score improves', () => {
    const ladder = [300, 560, 610, 660, 710, 760].map((score) => rangePositionInEighths(score));
    expect(ladder).toEqual([...ladder].sort((a, b) => b - a));
  });
});

describe('level payment and schedule: independent reference cases', () => {
  const reference = [
    {
      name: 'A typical: R150 000, 24 months, 12.5%',
      principal: 15_000_000,
      months: 24,
      bp: 1250,
      level: 709_610,
      first: {
        month: 1,
        payment: 709_610,
        principal: 553_360,
        interest: 156_250,
        balance: 14_446_640,
      },
      last: { month: 24, payment: 709_600, principal: 702_285, interest: 7_315, balance: 0 },
      interest: 2_030_630,
    },
    {
      name: 'B minimum personal: R5 000, 6 months, 18.5%',
      principal: 500_000,
      months: 6,
      bp: 1850,
      level: 87_887,
      first: { month: 1, payment: 87_887, principal: 80_179, interest: 7_708, balance: 419_821 },
      last: { month: 6, payment: 87_887, principal: 86_553, interest: 1_334, balance: 0 },
      interest: 27_322,
    },
    {
      name: 'C maximum personal: R300 000, 60 months, 10.5%',
      principal: 30_000_000,
      months: 60,
      bp: 1050,
      level: 644_817,
      first: {
        month: 1,
        payment: 644_817,
        principal: 382_317,
        interest: 262_500,
        balance: 29_617_683,
      },
      last: { month: 60, payment: 644_818, principal: 639_225, interest: 5_593, balance: 0 },
      interest: 8_689_021,
    },
    {
      name: 'D vehicle minimum: R50 000, 12 months, 10.13%',
      principal: 5_000_000,
      months: 12,
      bp: 1013,
      level: 439_882,
      first: {
        month: 1,
        payment: 439_882,
        principal: 397_674,
        interest: 42_208,
        balance: 4_602_326,
      },
      last: { month: 12, payment: 439_879, principal: 436_197, interest: 3_682, balance: 0 },
      interest: 278_581,
    },
    {
      name: 'E vehicle maximum: R1 500 000, 72 months, 8.5%',
      principal: 150_000_000,
      months: 72,
      bp: 850,
      level: 2_666_758,
      first: {
        month: 1,
        payment: 2_666_758,
        principal: 1_604_258,
        interest: 1_062_500,
        balance: 148_395_742,
      },
      last: { month: 72, payment: 2_666_726, principal: 2_647_970, interest: 18_756, balance: 0 },
      interest: 42_006_544,
    },
    {
      name: 'F zero interest: R1 000 over 3 months',
      principal: 100_000,
      months: 3,
      bp: 0,
      level: 33_334,
      first: { month: 1, payment: 33_334, principal: 33_334, interest: 0, balance: 66_666 },
      last: { month: 3, payment: 33_332, principal: 33_332, interest: 0, balance: 0 },
      interest: 0,
    },
    {
      name: 'G zero interest: R1 000 over 7 months',
      principal: 100_000,
      months: 7,
      bp: 0,
      level: 14_286,
      first: { month: 1, payment: 14_286, principal: 14_286, interest: 0, balance: 85_714 },
      last: { month: 7, payment: 14_284, principal: 14_284, interest: 0, balance: 0 },
      interest: 0,
    },
  ];

  it.each(reference)('$name', (c) => {
    const schedule = buildSchedule(c.principal, c.months, c.bp);
    expect(levelPaymentCents(c.principal, c.months, c.bp)).toBe(c.level);
    expect(schedule.levelPayment).toBe(c.level);
    expect(schedule.rows).toHaveLength(c.months);
    expect(schedule.rows[0]).toEqual(c.first);
    expect(schedule.rows.at(-1)).toEqual(c.last);
    expect(schedule.totalInterest).toBe(c.interest);
    expect(schedule.totalRepayment).toBe(c.principal + c.interest);
  });
});

describe('schedule invariants', () => {
  const cases: [number, number, number][] = [];
  for (const months of [6, 7, 12, 13, 24, 36, 59, 60, 72]) {
    for (const principal of [500_000, 1_234_567, 9_999_999, 30_000_000, 150_000_000]) {
      for (const bp of [0, 850, 1050, 1250, 1850]) cases.push([principal, months, bp]);
    }
  }

  it('amortises exactly: principals sum to the loan, the balance ends at zero, rows add up', () => {
    for (const [principal, months, bp] of cases) {
      const { rows, totalInterest, totalRepayment } = buildSchedule(principal, months, bp);
      expect(rows.map((row) => row.month)).toEqual(Array.from({ length: months }, (_, i) => i + 1));
      expect(rows.reduce((sum, row) => sum + row.principal, 0)).toBe(principal);
      expect(rows.at(-1)?.balance).toBe(0);
      expect(totalRepayment).toBe(principal + totalInterest);
      let previous = principal;
      for (const row of rows) {
        expect(row.payment).toBe(row.principal + row.interest);
        expect(row.balance).toBe(previous - row.principal);
        expect(row.balance).toBeGreaterThanOrEqual(0);
        expect(row.principal).toBeGreaterThan(0);
        previous = row.balance;
      }
    }
  });

  it('adjusts only the final payment, and by no more than the rounding can explain', () => {
    // Rounding the level payment to a cent leaves up to half a cent of error, which grows with
    // the interest accumulated over the term; plus up to a cent a month from interest rounding.
    for (const [principal, months, bp] of cases) {
      const { rows, levelPayment } = buildSchedule(principal, months, bp);
      for (const row of rows.slice(0, -1)) expect(row.payment).toBe(levelPayment);
      const r = bp / 10_000 / 12;
      const growth = r === 0 ? months : ((1 + r) ** months - 1) / r;
      const bound = Math.ceil(0.5 * growth) + months;
      const last = rows.at(-1);
      expect(Math.abs((last?.payment ?? 0) - levelPayment)).toBeLessThanOrEqual(bound);
    }
  });

  it('costs more interest over a longer term, and less at a lower rate', () => {
    const interest = (months: number, bp: number) =>
      buildSchedule(10_000_000, months, bp).totalInterest;
    expect(interest(12, 1250)).toBeLessThan(interest(24, 1250));
    expect(interest(24, 1250)).toBeLessThan(interest(60, 1250));
    expect(interest(24, 1050)).toBeLessThan(interest(24, 1250));
    expect(interest(24, 0)).toBe(0);
  });
});

describe('money helpers', () => {
  it('round-trips two-decimal rand amounts through whole cents', () => {
    for (const rand of [0, 0.01, 0.29, 1.1, 4454.14, 11_135.35, 299_999.99, 1_500_000]) {
      expect(centsToRand(randToCents(rand))).toBe(rand);
    }
    expect(randToCents(0.1 + 0.2)).toBe(30);
  });

  it('rounds half-up', () => {
    expect(roundHalfUp(162.5)).toBe(163);
    expect(roundHalfUp(162.49)).toBe(162);
    expect(roundHalfUp(0)).toBe(0);
  });
});
