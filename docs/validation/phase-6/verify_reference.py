"""Independent check of the mock API's pricing, written without the production code.

Run: python -I docs/validation/phase-6/verify_reference.py

It re-derives the level payment, every schedule row and the totals with 50-digit decimal
arithmetic and prints the reference values used by the unit tests. It also checks the
employer specification's own example figures (docs/requirements/).
"""

from decimal import Decimal as D, getcontext, ROUND_HALF_UP

getcontext().prec = 50
CENT = D('0.01')


def half_up(x: D, unit: D = D('1')) -> D:
    return (x / unit).quantize(D('1'), ROUND_HALF_UP) * unit


def rate_bp(low: str, high: str, eighths: int | None) -> int:
    """Basis points: min + (max - min) x eighths / 8, half-up (no score means 4 eighths)."""
    lo, hi = D(low) * 100, D(high) * 100
    return int(half_up(lo + (hi - lo) * (4 if eighths is None else eighths) / 8))


def level_payment(principal: D, months: int, bp: int) -> D:
    if bp == 0:
        return (principal / months).quantize(CENT, rounding='ROUND_CEILING')
    r = D(bp) / 10000 / 12
    return half_up(principal * r / (1 - (1 + r) ** -months), CENT)


def schedule(principal: D, months: int, bp: int):
    r = D(bp) / 10000 / 12
    pay = level_payment(principal, months, bp)
    rows, balance = [], principal
    for m in range(1, months + 1):
        interest = half_up(balance * r, CENT)
        princ = balance if m == months else min(pay - interest, balance)
        rows.append((m, princ + interest, princ, interest, balance - princ))
        balance -= princ
    return pay, rows


def show(label, principal, months, bp):
    pay, rows = schedule(D(principal), months, bp)
    ti = sum(r[3] for r in rows)
    tp = sum(r[2] for r in rows)
    tr = sum(r[1] for r in rows)
    first, last = rows[0], rows[-1]
    print(f'{label}: P={principal} n={months} rate={D(bp) / 100}%')
    print(f'  level payment {pay}; totals: principal {tp}, interest {ti}, repayment {tr}')
    print(f'  first row {tuple(str(x) for x in first)}')
    print(f'  last row  {tuple(str(x) for x in last)} (final payment differs from level by {last[1] - pay})')
    assert tp == D(principal) and rows[-1][4] == 0 and tr == tp + ti


print('== Rate by credit score (personal 10.5-18.5, vehicle 8.5-15.0), basis points')
for score, eighths in [(None, None), (850, 0), (750, 0), (720, 1), (650, 2), (620, 4), (570, 6), (400, 8)]:
    print(f'  score {score}: personal {rate_bp("10.5", "18.5", eighths)}, vehicle {rate_bp("8.5", "15.0", eighths)}')
print('  (vehicle at 650: 850 + 650 x 2/8 = 1012.5 -> half-up 1013, i.e. 10.13%)')

print('\n== Schedules')
show('A  typical', 150000, 24, rate_bp('10.5', '18.5', 2))
show('B  minimum personal', 5000, 6, rate_bp('10.5', '18.5', 8))
show('C  maximum personal', 300000, 60, rate_bp('10.5', '18.5', 0))
show('D  vehicle min', 50000, 12, rate_bp('8.5', '15.0', 2))
show('E  vehicle max', 1500000, 72, rate_bp('8.5', '15.0', 0))
show('F  zero interest', 1000, 3, 0)
show('G  zero interest, odd cents', 1000.00, 7, 0)

print('\n== Employer example (docs/requirements): 150000 over 24 months at 12.5%')
P, n = D(150000), 24
pay = level_payment(P, n, 1250)
print(f'  true level payment {pay} (spec shows 7089.50); spec month-1 interest 1562.33 vs {half_up(P * D(1250) / 10000 / 12, CENT)}')
print(f'  spec rows are self-consistent: 7089.50-1562.33={D("7089.50") - D("1562.33")}, 150000-5527.17={D("150000") - D("5527.17")}')
print(f'  but 7089.50 x 24 = {D("7089.50") * 24} and no single rate gives both 12.5% and 7089.50;')
print(f'  spec ratios: debt/income = {D(5000) / D(25000) * 100}% (matches), amount/(12 x income) = {D(150000) / D(12 * 25000) * 100}% (spec says 60.0)')
print(f'  spec 60.0 equals amount / (10 x income) = {D(150000) / D(10 * 25000) * 100}%; the formula is not given')
print(f'  sample payment 7096.10 vs available after expenses and debt {D(25000 - 15000 - 5000)}: repayment would exceed it')


# --------------------------------------------------------------------------------------------
# Eligibility scenarios: a second implementation of the documented mock rules
# (docs/SIMULATION_MODEL.md), in decimals, to cross-check the TypeScript.
# --------------------------------------------------------------------------------------------
def eligibility(income, expenses, debt, amount, months, score, status, duration):
    income, expenses, debt, amount = D(income), D(expenses), D(debt), D(amount)
    bp = rate_bp('10.5', '18.5', None if score is None else
                 (0 if score >= 750 else 1 if score >= 700 else 2 if score >= 650 else
                  4 if score >= 600 else 6 if score >= 550 else 8))
    available = income - expenses - debt
    fits = lambda pay: available > 0 and 5 * pay <= 2 * available
    pay = lambda p: level_payment(p, months, bp)
    max_amount = D(0)
    p = D(300000)
    while p >= 5000:
        if fits(pay(p)):
            max_amount = p
            break
        p -= 1000
    unemployed = status == 'unemployed'
    eligible = (not unemployed) and available > 0 and max_amount > 0
    if not eligible:
        max_amount = D(0)
    req_pay = pay(amount)
    if available <= 0:
        grade = 'poor'
    elif 5 * req_pay <= available:
        grade = 'excellent'
    elif 10 * req_pay <= 3 * available:
        grade = 'good'
    elif fits(req_pay):
        grade = 'fair'
    else:
        grade = 'poor'
    credit = 0 if score is None else (25 if score >= 750 else 20 if score >= 700 else 15 if score >= 650 else
                                       5 if score >= 600 else -5 if score >= 550 else -15)
    emp = -30 if unemployed else (5 if status in ('employed', 'self_employed') and duration >= 12 else 0)
    like = 50 + credit + {'excellent': 20, 'good': 15, 'fair': 10, 'poor': -20}[grade] + emp
    like = min(95, max(5, like))
    if not eligible:
        like = min(like, 15)
    risk = 'low' if like >= 75 else 'medium' if like >= 50 else 'high'
    rec = min(amount, max_amount) if eligible else D(0)
    rec_pay, rows = (schedule(rec, months, bp) if rec > 0 else (D(0), []))
    dti = half_up(debt / income * 1000) / 10
    lti = half_up(amount / (12 * income) * 1000) / 10
    return dict(eligible=eligible, likelihood=like, risk=risk, max=str(max_amount), recommended=str(rec),
                rate=str(D(bp) / 100), payment=str(rec_pay), total=str(sum((r[1] for r in rows), D(0))),
                disposable=str(income - expenses), dti=str(dti), lti=str(lti), grade=grade)


print('\n== Eligibility scenarios (age is irrelevant to the mock rules beyond validation)')
SCENARIOS = {
    'S1 spec sample inputs': (25000, 15000, 5000, 150000, 24, 650, 'employed', 24),
    'S2 comfortable': (40000, 15000, 3000, 100000, 36, 720, 'employed', 36),
    'S3 no credit score': (30000, 12000, 3000, 80000, 48, None, 'self_employed', 6),
    'S4 unemployed': (30000, 12000, 3000, 80000, 48, 700, 'unemployed', 6),
    'S5 nothing left': (12000, 9000, 3000, 20000, 24, 650, 'employed', 24),
    'S6 below smallest loan': (5000, 4500, 0, 20000, 6, 650, 'employed', 24),
    'S7 retired, low score': (18000, 8000, 2000, 30000, 36, 540, 'retired', 12),
}
for name, args in SCENARIOS.items():
    print(f'  {name}: {eligibility(*args)}')
