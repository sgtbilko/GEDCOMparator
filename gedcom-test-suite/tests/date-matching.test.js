// Tests the date exactness hierarchy: Exact > About > Year > Bef/Aft, and the
// v4 tightening: an EXACT (full day/month/year) date on EITHER side of a
// comparison gets zero tolerance — the flat 3-month tolerance only applies
// when BOTH sides are merely approximate (About/Year).
const { loadApp, check, summary } = require('../harness');

const app = loadApp();
const { datesMatch } = app;

const cases = [
  // [a, b, expected, description]
  ['12 Nov 1900', '12 November 1900', true, 'Nov vs November — exact match'],
  ['12 NOV 1900', '12 nov. 1900', true, 'case + trailing-period insensitivity'],
  ['ABT 1900', 'Abt 1900', true, 'ABT case variants — identical'],
  ['ABT 1900', '1 Jan 1900', false, 'ABT year-only midpoint (mid-year) vs an EXACT date — zero tolerance since the other side is exact'],
  // v4 regression: before v4, an approximate date within 91 days of an EXACT
  // date on the other side used to match (the old rule only zeroed tolerance
  // when BOTH sides were exact). v4 tightened this: since 15 Jul 1900 is a
  // firm, exact claim, a merely-approximate date on the other side no longer
  // gets any tolerance at all, however close it looks.
  ['ABT Jun 1900', '15 Jul 1900', false, 'v4: ABT with month vs an EXACT date, only 30 days apart — no longer a match once either side is exact'],
  ['15 Jul 1900', 'ABT Jun 1900', false, 'v4: same case with sides swapped — order does not matter'],
  ['ABT Jan 1900', '15 Sep 1900', false, 'ABT with month vs exact date, NOT within 3 months either way'],
  ['Bef 1900', 'Bef 1900', true, 'identical Bef dates match'],
  ['Bef 1900', 'Bef 1850', false, 'different Bef dates do NOT match (must be identical)'],
  ['Aft 1850', 'Aft 1850', true, 'identical Aft dates match'],
  ['Bef 1900', 'Aft 1900', false, 'Bef vs Aft, same date value but opposite qualifier — non-match'],
  ['Bef 1900', '1900', false, 'Bef vs a precise date — non-match'],
  ['Bef 1900', 'ABT 1900', false, 'Bef vs About — non-match'],
  ['1900', '1900', true, 'plain year vs same plain year'],
  ['1900', '1901', false, 'plain year vs different plain year'],
  ['Jun 1900', 'Jul 1900', true, 'month-year, 1 month apart, BOTH approximate — flat tolerance still applies'],
  ['Jun 1900', 'Jan 1900', false, 'month-year, 5 months apart — non-match under flat 3mo tolerance'],
  ['Jun 1900', 'Sep 1900', false, 'month-year, ~92 days apart (just over the 91-day tolerance) — non-match'],
  ['12 Jan 1900', '13 Jan 1900', false, 'two exact dates, different day — non-match'],
  ['12 Jan 1900', '12 Jan 1900', true, 'two identical exact dates'],
  ['', '', true, 'both blank'],
  ['12 Jan 1900', '', false, 'one blank, one filled'],
  ['BEF. 1905', 'before 1905', true, 'Bef variants (BEF. / before), identical date'],
  ['AFT 1905', 'after 1905', true, 'Aft variants, identical date'],
  ['3 Sept. 1888', '3 Sep 1888', true, 'Sept./Sep abbreviation variants'],
];

for (const [a, b, expected, desc] of cases) {
  check(datesMatch(a, b), expected, `"${a}" vs "${b}" — ${desc}`);
}

// Informational only — not a pass/fail case, just documents the fallback behavior.
const rangeResult = datesMatch('Between 1900 and 1905', '1902');
console.log(`INFO | "Between 1900 and 1905" vs "1902" => ${rangeResult} (unrecognized range format falls back to a plain string compare)`);

process.exit(summary('date-matching'));
