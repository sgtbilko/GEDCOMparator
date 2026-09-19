// Tests the "Group results by ancestor" toggle: checked (default) keeps the
// existing one-section-per-ancestor layout with match-cards beneath;
// unchecked shows every individual as their own section with no nested
// match-card, and every individual still appears exactly once.
const { loadApp, check, summary } = require('../harness');

// Root -> Father -> (Father's siblings: Uncle) + Father's spouse (Mother,
// already an ancestor so must be de-duplicated) + Root's own spouse.
const gedA = `0 @I1@ INDI
1 NAME Root /Person/
1 FAMC @F1@
1 FAMS @FR@
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
0 @I5@ INDI
1 NAME Spouse /Person/
1 FAMS @FR@
0 @F1@ FAM
1 HUSB @I2@
1 WIFE @I3@
1 CHIL @I1@
0 @F2@ FAM
1 CHIL @I2@
1 CHIL @I4@
0 @FR@ FAM
1 HUSB @I1@
1 WIFE @I5@
`;
const gedB = `0 @P1@ INDI
1 NAME Root /Person/
1 FAMC @G1@
1 FAMS @GR@
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
0 @P5@ INDI
1 NAME Spouse /Person/
1 FAMS @GR@
0 @G1@ FAM
1 HUSB @P2@
1 WIFE @P3@
1 CHIL @P1@
0 @G2@ FAM
1 CHIL @P2@
1 CHIL @P4@
0 @GR@ FAM
1 HUSB @P1@
1 WIFE @P5@
`;

const app = loadApp({ rootA: 'I1', rootB: 'P1', maxGen: '2', includeSiblings: true, hideExactMatches: false });
app.loadGedcomFiles(gedA, gedB);
app.runCompare();

// --- grouped mode (default): unchanged shape, match-cards under headers ---
let html = app._document.getElementById('report').innerHTML;
check(/class="match-card(\s|")/.test(html), true, 'grouped mode still renders match-cards beneath ancestor headers');
check(html.includes('class="section-body'), false, 'grouped mode never renders the flat-mode section-body');
check((html.match(/class="section-head /g) || []).length, 3, 'grouped mode has one header per ancestor generation (Root, Father, Mother)');

// --- flat mode: every individual is its own section, no match-card ---
app._document.getElementById('groupByAncestor').checked = false;
app.onGroupByAncestorChange();
html = app._document.getElementById('report').innerHTML;
check(/class="match-card(\s|")/.test(html), false, 'flat mode never renders a bordered match-card');
check(html.includes('class="section-body'), true, 'flat mode renders each individual\'s attributes as a plain section-body');

// Every named individual (Root, Dad, Mum, Uncle, Spouse) appears exactly once
// as a section/card *heading* (each also appears a second time as the value
// of their own "Name" field in the attributes table, which is expected and
// unrelated to the dedup being tested here).
for (const name of ['Root Person', 'Dad Person', 'Mum Person', 'Uncle Person', 'Spouse Person']) {
  const occurrences = html.split(`match-header-name">${name}`).length - 1;
  check(occurrences, 1, `${name} has exactly one heading in flat mode`);
}
// Mum, who is both a direct ancestor AND technically Dad's spouse, must not
// be double-counted as a separate "Spouse" section thanks to the existing
// ancestor-dedup logic carrying through into the flattened list.
check(html.split('match-header-name">Mum Person').length - 1, 1, 'Mum (an ancestor) is not also listed again as a spouse');

// --- switching modes resets collapse state per the master checkbox ---
app._document.getElementById('hideAllSubDetails').checked = true;
app.onHideAllSubDetailsChange();
app._document.getElementById('groupByAncestor').checked = true;
app.onGroupByAncestorChange();
html = app._document.getElementById('report').innerHTML;
check(/class="section section-collapsed"/.test(html), true, 'switching back to grouped mode re-collapses using the master checkbox state');

// --- top-line summary counts are identical regardless of grouping ---
app._document.getElementById('hideAllSubDetails').checked = false;
app.onHideAllSubDetailsChange();
const groupedSummary = app._document.getElementById('report').innerHTML.match(/<div class="num">(\d+)<\/div>/g);
app._document.getElementById('groupByAncestor').checked = false;
app.onGroupByAncestorChange();
const flatSummary = app._document.getElementById('report').innerHTML.match(/<div class="num">(\d+)<\/div>/g);
check(flatSummary, groupedSummary, 'summary counts (matched/diffs/missing) are unaffected by grouping mode');

process.exit(summary('display-mode'));
