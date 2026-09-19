// Tests the "descendant generations (children of ancestors)" option:
//  - it should surface genuinely new people (e.g. the root's own child)
//  - it should NOT duplicate anyone already shown as an ancestor/sibling/spouse
//    (e.g. a sibling's own child is out of scope — descendants only follow direct
//    ancestors, not collateral relatives)
const { loadApp, check, summary } = require('../harness');

// Root has a sibling (Uncle). Uncle has a child (Cousin) — out of scope for descendants.
// Root also has his own child (Kid), present only in file A (missing from B).
const gedA = `0 @I1@ INDI
1 NAME Root /Person/
1 FAMC @F2@
1 FAMS @FK@
0 @I2@ INDI
1 NAME Uncle /Person/
1 FAMC @F2@
1 FAMS @FU@
0 @I3@ INDI
1 NAME Cousin /Person/
1 BIRT
2 DATE 1950
1 FAMC @FU@
0 @I4@ INDI
1 NAME Kid /Person/
1 FAMC @FK@
0 @F2@ FAM
1 CHIL @I1@
1 CHIL @I2@
0 @FU@ FAM
1 CHIL @I3@
0 @FK@ FAM
1 CHIL @I4@
`;

const gedB = `0 @P1@ INDI
1 NAME Root /Person/
1 FAMC @G2@
0 @P2@ INDI
1 NAME Uncle /Person/
1 FAMC @G2@
1 FAMS @GU@
0 @P3@ INDI
1 NAME Cousin /Person/
1 BIRT
2 DATE 1950
1 FAMC @GU@
0 @G2@ FAM
1 CHIL @P1@
1 CHIL @P2@
0 @GU@ FAM
1 CHIL @P3@
`;

const app = loadApp({ rootA: 'I1', rootB: 'P1', maxGen: '3', descendantGen: '2', includeSiblings: true });
app.loadGedcomFiles(gedA, gedB);
app.runCompare();

const rootSection = app.getVar('lastSections').find(s => s.label === 'Root');
const rows = rootSection.rows.map(r => `${r.role}:${r.status}:${r.name}`);

check(rows.includes('Ancestor:both:Root Person'), true, 'Root himself appears as Ancestor');
check(rows.includes('Sibling:both:Uncle Person'), true, 'Uncle appears as Sibling');
check(rows.includes('Child:missB:Kid Person'), true,
  'Kid (root\'s own child, only in file A) appears as a new "Child" descendant row');
check(rows.some(r => r.includes('Cousin')), false,
  'Cousin (a sibling\'s child, not a direct ancestor\'s child) is correctly out of scope');

process.exit(summary('descendant-generations'));
