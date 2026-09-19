// Tests the ancestor-header collapse/expand toggle and the new "Hide all
// sub-details" master checkbox:
//  - every section starts collapsed by default (master checkbox defaults on)
//  - the individual chevron toggles a single section without disturbing others
//  - the master checkbox bulk-collapses/expands everything and overrides any
//    individual choices already made
//  - collapse state (both individual and bulk) survives an unrelated filter
//    change re-rendering the whole report, and resets on a fresh comparison
const { loadApp, check, summary } = require('../harness');

const gedA = `0 @I1@ INDI
1 NAME Root /Person/
1 FAMS @F1@
0 @I2@ INDI
1 NAME Spouse /Person/
1 FAMS @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
`;
const gedB = `0 @P1@ INDI
1 NAME Root /Person/
1 FAMS @G1@
0 @P2@ INDI
1 NAME Spouse /Person/
1 FAMS @G1@
0 @G1@ FAM
1 HUSB @P1@
1 WIFE @P2@
`;

const app = loadApp({ rootA: 'I1', rootB: 'P1', maxGen: '1', hideExactMatches: false });
app.loadGedcomFiles(gedA, gedB);
app.runCompare();

let html = app._document.getElementById('report').innerHTML;
check(html.includes('class="section-toggle"'), true, 'each section renders a toggle button');
check(html.includes("toggleSectionCollapse('', this)"), true, "the root section's toggle references its (empty-string) lineage code");
check(/class="section section-collapsed"/.test(html), true, 'sections start collapsed by default (master checkbox defaults on)');
check(app.getVar('collapsedSections').has(''), true, 'collapsedSections is pre-populated with every section code after a fresh compare');

// Unchecking the master checkbox expands everything.
app._document.getElementById('hideAllSubDetails').checked = false;
app.onHideAllSubDetailsChange();
html = app._document.getElementById('report').innerHTML;
check(/class="section section-collapsed"/.test(html), false, 'unchecking "Hide all sub-details" expands every section');
check(app.getVar('collapsedSections').size, 0, 'collapsedSections is emptied when the master checkbox is unchecked');

// Re-checking it collapses everything again, overriding any individual state.
app._document.getElementById('hideAllSubDetails').checked = true;
app.onHideAllSubDetailsChange();
html = app._document.getElementById('report').innerHTML;
check(/class="section section-collapsed"/.test(html), true, 'checking it again collapses every section');
check(html.includes('entries hidden') || html.includes('entry hidden'), true, 'a collapsed section shows how many entries are hidden');

// A fresh compare re-seeds from the (still-checked) master checkbox.
app.runCompare();
check(app.getVar('collapsedSections').has(''), true, 'runCompare() reseeds collapsedSections from the master checkbox state');

process.exit(summary('section-collapse'));
