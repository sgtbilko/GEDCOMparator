// Tests computeSectionStatus() — the ancestor section header's red/amber/green
// colour, computed over every row under that ancestor:
//  - red: a missing person, or a substantially-different matched pair
//  - amber: an unresolved "maybe" match, or a routine (non-substantial) diff
//  - green: everything is a clean match, or excused by settings/review
const { loadApp, check, summary } = require('../harness');

function section(rows) { return { rows }; }
function row(overrides) {
  return Object.assign({ id: row._id = (row._id || 0) + 1, status: 'both', fieldDiffs: [], substantiallyDifferent: false, birthDate: '1900' }, overrides);
}

const app = loadApp();
const { computeSectionStatus } = app;
const IGNORE_ALIVE = true, ALIVE_YEARS = 80, HIDE_NO_DOB = false, IGNORE_SIM_LOC = true, LOC_THRESH = 0.5;
const call = (rows) => computeSectionStatus(section(rows), IGNORE_ALIVE, ALIVE_YEARS, HIDE_NO_DOB, IGNORE_SIM_LOC, LOC_THRESH);

// --- green cases ---
check(call([row({ status: 'both', fieldDiffs: [{ same: true, type: 'text' }] })]), 'green',
  'a single clean matched row is green');
check(call([
  row({ status: 'both', fieldDiffs: [{ same: true, type: 'text' }] }),
  row({ status: 'missB', birthDate: '2015' }) // a very recent birth, no death — likely still alive, excused
]), 'green',
  'a missing person excused by "hide people likely still alive" does not turn the header red');
check(call([
  row({ id: 99, status: 'both', fieldDiffs: [{ same: false, type: 'text' }] })
]), 'amber',
  'sanity: an actual unresolved diff (not reviewed) is NOT green — confirms the excusal above is doing real work');

// --- amber cases ---
check(call([row({ status: 'both', fieldDiffs: [{ same: false, type: 'text' }] })]), 'amber',
  'a matched row with a real (non-substantial) field difference is amber');
check(call([row({ status: 'maybe', fieldDiffs: [{ same: true, type: 'text' }] })]), 'amber',
  'an unverified "maybe" match is amber even with no field diffs');
check(call([
  row({ status: 'both', fieldDiffs: [{ same: false, type: 'place', similarity: 0.6 }] })
]), 'green',
  'a location difference that similarity-matching would hide is treated as a clean match (green), not amber');

// --- red cases ---
check(call([row({ status: 'missA' })]), 'red', 'a missing person (not excused) is red');
check(call([row({ status: 'both', substantiallyDifferent: true, fieldDiffs: [{ same: false, type: 'text' }] })]), 'red',
  'a substantially-different matched row is red');
check(call([
  row({ status: 'both', substantiallyDifferent: true }),
  row({ status: 'both', fieldDiffs: [{ same: false, type: 'text' }] })
]), 'red',
  'red outranks amber when both are present in the same section');

// --- reviewed rows are always excused, whatever their status ---
{
  const reviewedRow = row({ id: 555, status: 'missA' });
  app.getVar('reviewedIds').add(555);
  check(call([reviewedRow]), 'green', 'a reviewed missing-person row does not turn the header red');
  const reviewedDiff = row({ id: 556, status: 'both', substantiallyDifferent: true });
  app.getVar('reviewedIds').add(556);
  check(call([reviewedDiff]), 'green', 'a reviewed substantially-different row does not turn the header red');
}

// --- hideNoBirthDate excusal ---
check(computeSectionStatus(
  section([row({ status: 'both', birthDate: '', fieldDiffs: [{ same: false, type: 'text' }] })]),
  IGNORE_ALIVE, ALIVE_YEARS, /* hideNoBirthDate */ true, IGNORE_SIM_LOC, LOC_THRESH
), 'green', 'a diff on a person with no birth date is excused when "hide people with no date of birth" is on');

process.exit(summary('section-status'));
