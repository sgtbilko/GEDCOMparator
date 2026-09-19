// Tests the "Only show significant differences (red)" filter: it should keep
// only rows that would make a section header red (a non-excused missing
// person, or a substantially-different matched pair), hiding everything
// amber or green — in both grouped and flat display modes — while leaving
// the summary's totalCompared/totalMissing counts unaffected (matching the
// same "hidden, not uncounted" treatment as "Hide exact matches").
const { loadApp, check, summary } = require('../harness');

// Root has three siblings under the same "Father" ancestor section:
//  - Clean:  an exact match (green)
//  - Fuzzy:  a matched pair with an ordinary, non-substantial diff (amber)
//  - Rogue:  a matched pair with a substantially different name (red)
// Plus one sibling missing entirely from File B (also red).
const gedA = `0 @I1@ INDI
1 NAME Root /Person/
1 FAMC @F2@
0 @I2@ INDI
1 NAME Clean /Person/
1 BIRT
2 DATE 1900
2 PLAC Boston
1 FAMC @F2@
0 @I3@ INDI
1 NAME Fuzzy /Person/
1 BIRT
2 DATE 1900
2 PLAC Boston
1 FAMC @F2@
0 @I4@ INDI
1 NAME Rogue /Person/
1 BIRT
2 DATE 1900
1 FAMC @F2@
0 @I5@ INDI
1 NAME OnlyInA /Person/
1 FAMC @F2@
0 @F2@ FAM
1 CHIL @I1@
1 CHIL @I2@
1 CHIL @I3@
1 CHIL @I4@
1 CHIL @I5@
`;
const gedB = `0 @P1@ INDI
1 NAME Root /Person/
1 FAMC @G2@
0 @P2@ INDI
1 NAME Clean /Person/
1 BIRT
2 DATE 1900
2 PLAC Boston
1 FAMC @G2@
0 @P3@ INDI
1 NAME Fuzzy /Person/
1 BIRT
2 DATE 1905
2 PLAC Boston
1 FAMC @G2@
0 @P4@ INDI
1 NAME Zachary /Person/
1 BIRT
2 DATE 1900
1 FAMC @G2@
0 @G2@ FAM
1 CHIL @P1@
1 CHIL @P2@
1 CHIL @P3@
1 CHIL @P4@
`;

const app = loadApp({ rootA: 'I1', rootB: 'P1', maxGen: '1', includeSiblings: true, hideExactMatches: false, ignoreLikelyAlive: false });
app.loadGedcomFiles(gedA, gedB);
app.runCompare();

// Baseline: everything visible with the filter off.
let html = app._document.getElementById('report').innerHTML;
for (const name of ['Clean Person', 'Fuzzy Person', 'Rogue Person', 'OnlyInA Person']) {
  check(html.includes(name), true, `${name} is visible with "only significant" off`);
}
const baselineSummary = html.match(/<div class="num">(\d+)<\/div>/g);

// Turn the filter on: only Rogue (substantially different) and OnlyInA
// (missing, not excused) should remain.
app._document.getElementById('onlySignificant').checked = true;
app.onOnlySignificantChange();
html = app._document.getElementById('report').innerHTML;
check(html.includes('Rogue Person'), true, 'a substantially-different match survives "only show significant"');
check(html.includes('OnlyInA Person'), true, 'a missing (non-excused) person survives "only show significant"');
check(html.includes('Clean Person'), false, 'an exact match is hidden by "only show significant"');
check(html.includes('Fuzzy Person'), false, 'an ordinary (non-substantial) diff is hidden by "only show significant"');
check(html.includes('without a significant difference hidden'), true, 'the hidden-count legend mentions non-significant items');

// Summary counts must be identical whether or not the filter is applied —
// it only changes what's displayed, same as "Hide exact matches".
const filteredSummary = html.match(/<div class="num">(\d+)<\/div>/g);
check(filteredSummary, baselineSummary, 'summary counts are unchanged by "only show significant"');

// "Hide exact matches" becomes moot and gets disabled while this is on.
check(app._document.getElementById('hideExactMatches').disabled, true,
  '"Hide exact matches" is disabled while "only show significant" is checked');
app._document.getElementById('onlySignificant').checked = false;
app.onOnlySignificantChange();
check(app._document.getElementById('hideExactMatches').disabled, false,
  '"Hide exact matches" is re-enabled once "only show significant" is unchecked');

// Also works in flat (ungrouped) mode, on the same underlying rows.
app._document.getElementById('onlySignificant').checked = true;
app._document.getElementById('groupByAncestor').checked = false;
app.onOnlySignificantChange();
app.onGroupByAncestorChange();
html = app._document.getElementById('report').innerHTML;
check(html.includes('Rogue Person') && html.includes('OnlyInA Person'), true,
  'flat mode also keeps only significant rows');
check(html.includes('Clean Person') || html.includes('Fuzzy Person'), false,
  'flat mode also hides non-significant rows');

process.exit(summary('only-significant'));
