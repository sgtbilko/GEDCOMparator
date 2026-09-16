// Tests that direct ancestors are never repeated elsewhere in the report — e.g. a
// father's spouse who is also the root's mother should appear only once, under her
// own "Mother" ancestor section, not again as "Spouse" under "Father".
const { loadApp, check, summary } = require('../harness');

const gedA = `0 @I1@ INDI
1 NAME Root /Person/
1 FAMC @F1@
0 @I2@ INDI
1 NAME Dad /Person/
1 FAMS @F1@
1 FAMC @F2@
0 @I3@ INDI
1 NAME Mum /Person/
1 FAMS @F1@
0 @I4@ INDI
1 NAME Uncle /Person/
1 FAMC @F2@
0 @F1@ FAM
1 HUSB @I2@
1 WIFE @I3@
0 @F2@ FAM
1 CHIL @I2@
1 CHIL @I4@
`;

const gedB = `0 @P1@ INDI
1 NAME Root /Person/
1 FAMC @G1@
0 @P2@ INDI
1 NAME Dad /Person/
1 FAMS @G1@
1 FAMC @G2@
0 @P3@ INDI
1 NAME Mum /Person/
1 FAMS @G1@
0 @P4@ INDI
1 NAME Uncle /Person/
1 FAMC @G2@
0 @G1@ FAM
1 HUSB @P2@
1 WIFE @P3@
0 @G2@ FAM
1 CHIL @P2@
1 CHIL @P4@
`;

const app = loadApp({ rootA: 'I1', rootB: 'P1', maxGen: '3', descendantGen: '0' });
app.loadGedcomFiles(gedA, gedB);
app.runCompare();

const bySection = {};
for (const s of app.getVar('lastSections')) {
  bySection[s.label] = s.rows.map(r => `${r.role}:${r.name}`);
}

check(bySection['Root'], ['Ancestor:Root Person'], 'Root section has only the ancestor');
check(bySection['Father'], ['Ancestor:Dad Person', 'Sibling:Uncle Person'],
  'Father section has himself + his genuine sibling (Uncle), no duplicate');
check(bySection['Mother'], ['Ancestor:Mum Person'],
  'Mother appears once under her own section — NOT duplicated as "Spouse" under Father');

process.exit(summary('ancestor-dedup'));
