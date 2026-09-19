// Tests the new "substantially different" header-flagging logic:
//  - a matched pair's header/badge turns red (substantiallyDifferent: true) when
//    the name or birth details genuinely conflict
//  - it stays green for routine messiness: extra/missing/reordered middle names,
//    a couple of characters of spelling drift, or one side simply missing a field
const { loadApp, check, summary } = require('../harness');

const app = loadApp();
const { nameSubstantiallyDifferent, birthSubstantiallyDifferent, isSubstantiallyDifferent, levenshteinDistance } = app;

function name(given, surname) { return { given, surname, full: `${given} ${surname}`.trim() }; }
function ind(given, surname, birthDate, birthPlace) {
  return { name: name(given, surname), birth: { date: birthDate || '', place: birthPlace || '' }, death: { date: '', place: '' } };
}

// --- levenshteinDistance sanity ---
check(levenshteinDistance('catherine', 'katherine'), 1, 'levenshtein: Catherine/Katherine is 1 edit');
check(levenshteinDistance('smith', 'smith'), 0, 'levenshtein: identical strings are 0 edits');

// --- name: not substantial (routine messiness) ---
check(nameSubstantiallyDifferent(name('John', 'Smith'), name('John Michael', 'Smith')), false,
  'name: extra middle name only — not substantial');
check(nameSubstantiallyDifferent(name('John Michael', 'Smith'), name('John', 'Smith')), false,
  'name: missing middle name only — not substantial');
check(nameSubstantiallyDifferent(name('John Michael Robert', 'Smith'), name('John Robert Michael', 'Smith')), false,
  'name: reordered middle names — not substantial');
check(nameSubstantiallyDifferent(name('Catherine', 'Smith'), name('Katherine', 'Smith')), false,
  'name: 1-character spelling variant on given name — not substantial');
check(nameSubstantiallyDifferent(name('John', 'Andersen'), name('John', 'Anderson')), false,
  'name: couple-character spelling variant on surname — not substantial');
check(nameSubstantiallyDifferent(name('Smith', 'Jones'), name('Smyte', 'Jones')), false,
  'name: exactly 2-character edit distance on given name — allowed, not just 1');
check(nameSubstantiallyDifferent(name('', 'Smith'), name('John', 'Smith')), false,
  'name: given name blank on one side only — missing data, not a conflict');

// --- name: substantial ---
check(nameSubstantiallyDifferent(name('John', 'Smith'), name('Robert', 'Smith')), true,
  'name: different given name entirely — substantial');
check(nameSubstantiallyDifferent(name('John', 'Smith'), name('John', 'Jones')), true,
  'name: different surname entirely — substantial');
check(nameSubstantiallyDifferent(name('John', 'Smith'), name('Jonathan', 'Smith')), true,
  'name: given names that only share a prefix (5+ edits) — substantial');

// --- birth: not substantial ---
check(birthSubstantiallyDifferent(ind('A', 'B', '1900'), ind('A', 'B', '1905')), false,
  'birth: 5-year gap — not substantial');
check(birthSubstantiallyDifferent(ind('A', 'B', '1900'), ind('A', 'B', '')), false,
  'birth: date blank on one side — missing data, not a conflict');
check(birthSubstantiallyDifferent(ind('A', 'B', '', 'Springfield, Illinois'), ind('A', 'B', '', 'Springfield, Illinois, USA')), false,
  'birth: places are close variants of the same description — not substantial');
check(birthSubstantiallyDifferent(ind('A', 'B', '', 'Springfield, Sangamon County, Illinois, USA'), ind('A', 'B', '', 'USA')), false,
  'birth: a short place is a superset/subset of a much longer one — not substantial even though bigram similarity is low');
check(birthSubstantiallyDifferent(ind('A', 'B', '', 'Torgau, Germany'), ind('A', 'B', '', 'Germany')), false,
  'birth: city+country vs. just the country — not substantial');

// --- birth: substantial ---
check(birthSubstantiallyDifferent(ind('A', 'B', '1900'), ind('A', 'B', '1920')), true,
  'birth: 20-year gap — substantial');
check(birthSubstantiallyDifferent(ind('A', 'B', '', 'Springfield, Illinois'), ind('A', 'B', '', 'Tokyo, Japan')), true,
  'birth: unrelated places recorded on both sides — substantial');

// --- combined ---
check(isSubstantiallyDifferent(ind('John', 'Smith', '1900'), ind('Robert', 'Smith', '1900')), true,
  'combined: name conflict alone is enough to flag');
check(isSubstantiallyDifferent(ind('John', 'Smith', '1900'), ind('John', 'Smith', '1950')), true,
  'combined: birth-year conflict alone is enough to flag');
check(isSubstantiallyDifferent(ind('John Michael', 'Smith', '1900', 'Boston'), ind('John', 'Smith', '1905', 'Boston, Massachusetts')), false,
  'combined: routine messiness on both fronts — not flagged');
check(isSubstantiallyDifferent(null, ind('John', 'Smith')), false, 'combined: a missing-person row (no counterpart) is never flagged');

// --- end-to-end: runCompare() actually attaches the flag and it reaches the report ---
const gedA = `0 @I1@ INDI
1 NAME John /Smith/
1 FAMS @F1@
1 BIRT
2 DATE 1900
0 @I2@ INDI
1 NAME Jane /Doe/
1 FAMS @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
`;
const gedB = `0 @P1@ INDI
1 NAME Robert /Smith/
1 FAMS @G1@
1 BIRT
2 DATE 1900
0 @P2@ INDI
1 NAME Jane /Doe/
1 FAMS @G1@
0 @G1@ FAM
1 HUSB @P1@
1 WIFE @P2@
`;
const cmpApp = loadApp({ rootA: 'I1', rootB: 'P1', maxGen: '1' });
cmpApp.loadGedcomFiles(gedA, gedB);
cmpApp.runCompare();
const rootSection = cmpApp.getVar('lastSections').find(s => s.label === 'Root');
check(rootSection.ancestorHeader.substantiallyDifferent, true,
  'end-to-end: root ancestor with a genuinely different given name is flagged on the row');
const spouseRow = rootSection.rows.find(r => r.role === 'Spouse');
check(spouseRow.substantiallyDifferent, false,
  'end-to-end: exactly-matching spouse is not flagged');

process.exit(summary('substantial-difference'));
