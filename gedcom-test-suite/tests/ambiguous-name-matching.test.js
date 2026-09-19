// Regression test for a real bug: when two individuals in one file share the
// exact same name and File A's version of that person has no birth year to
// disambiguate them, matchLists used to silently commit to the FIRST same-named
// candidate with full ("match") confidence — an arbitrary guess dressed up as
// certainty. If that arbitrarily-chosen person happened to have blank fields
// (e.g. no recorded birth place), the real match (who DID have a birth place
// recorded) was displaced entirely and reported as missing from File A, while
// the wrong person's blank data was shown as if it were a confirmed comparison.
//
// Fix: matchLists now also tries death year as a second disambiguator, and if
// candidates are still tied after that, only ever offers the match at 'maybe'
// confidence — so genuine ambiguity is surfaced ("Possible match — verify")
// instead of silently hidden behind a false-confident "In both files" badge.
const { loadApp, check, summary } = require('../harness');

// --- Case 1: genuinely ambiguous — no birth year, no death year anywhere to
// tell the two same-named Johns apart. Should be flagged 'maybe', not 'both'.
{
  const gedA = `0 @I1@ INDI
1 NAME Root /Person/
1 FAMC @F1@
0 @I2@ INDI
1 NAME Dad /Person/
1 FAMS @F1@
1 FAMC @F2@
0 @I3@ INDI
1 NAME John /Smith/
1 FAMC @F2@
0 @F1@ FAM
1 HUSB @I2@
0 @F2@ FAM
1 CHIL @I2@
1 CHIL @I3@
`;

  const gedB = `0 @P1@ INDI
1 NAME Root /Person/
1 FAMC @G1@
0 @P2@ INDI
1 NAME Dad /Person/
1 FAMS @G1@
1 FAMC @G2@
0 @P3@ INDI
1 NAME John /Smith/
1 FAMC @G2@
0 @P4@ INDI
1 NAME John /Smith/
1 BIRT
2 DATE 1850
2 PLAC Springfield, Illinois
1 FAMC @G2@
0 @G1@ FAM
1 HUSB @P2@
0 @G2@ FAM
1 CHIL @P2@
1 CHIL @P3@
1 CHIL @P4@
`;

  const app = loadApp({ rootA: 'I1', rootB: 'P1', maxGen: '2', descendantGen: '0', includeSiblings: true });
  app.loadGedcomFiles(gedA, gedB);
  app.runCompare();
  const fatherSection = app.getVar('lastSections').find(s => s.label === 'Father');
  const johnRows = fatherSection.rows.filter(r => r.name === 'John Smith');

  check(johnRows.length, 2, 'ambiguous case: both same-named Johns show up somewhere in the section');
  check(johnRows.some(r => r.status === 'maybe'), true,
    'ambiguous case: the ambiguous pairing is flagged "maybe", never a confident "both"');
  check(johnRows.some(r => r.status === 'both'), false,
    'ambiguous case: no confident match is claimed when the two candidates are truly indistinguishable');
}

// --- Case 2: resolvable via death year even though birth year is missing —
// should still be a confident 'both' match, and should show the REAL birth
// place rather than a blank one from the wrong, same-named candidate.
{
  const gedA = `0 @I1@ INDI
1 NAME Root /Person/
1 FAMC @F1@
0 @I2@ INDI
1 NAME Dad /Person/
1 FAMS @F1@
1 FAMC @F2@
0 @I3@ INDI
1 NAME John /Smith/
1 DEAT
2 DATE 1920
1 FAMC @F2@
0 @F1@ FAM
1 HUSB @I2@
0 @F2@ FAM
1 CHIL @I2@
1 CHIL @I3@
`;

  const gedB = `0 @P1@ INDI
1 NAME Root /Person/
1 FAMC @G1@
0 @P2@ INDI
1 NAME Dad /Person/
1 FAMS @G1@
1 FAMC @G2@
0 @P3@ INDI
1 NAME John /Smith/
1 DEAT
2 DATE 1955
1 FAMC @G2@
0 @P4@ INDI
1 NAME John /Smith/
1 BIRT
2 DATE 1850
2 PLAC Springfield, Illinois
1 DEAT
2 DATE 1920
1 FAMC @G2@
0 @G1@ FAM
1 HUSB @P2@
0 @G2@ FAM
1 CHIL @P2@
1 CHIL @P3@
1 CHIL @P4@
`;

  const app = loadApp({ rootA: 'I1', rootB: 'P1', maxGen: '2', descendantGen: '0', includeSiblings: true });
  app.loadGedcomFiles(gedA, gedB);
  app.runCompare();
  const fatherSection = app.getVar('lastSections').find(s => s.label === 'Father');
  const johnRow = fatherSection.rows.find(r => r.name === 'John Smith' && r.status !== 'missA');

  check(johnRow.status, 'both', 'death-year disambiguation: resolves to a confident match');
  const birthPlace = johnRow.fieldDiffs.find(f => f.label === 'Birth place');
  check(birthPlace.b, 'Springfield, Illinois',
    'death-year disambiguation: shows the REAL birth place from the correctly-matched John, not a blank from the wrong one');
}

process.exit(summary('ambiguous-name-matching'));
