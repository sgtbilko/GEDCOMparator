// Tests the root-person selection panel: tryAutoMatchRoot's same-name
// auto-detection, the dropdown option list/filtering, and the deliberately
// one-way mirroring between the two filter boxes (typing in File A's filter
// live-updates File B's, until the person edits File B's box themselves, at
// which point File A's typing stops overwriting it).
const { loadApp, check, summary } = require('../harness');

// --- tryAutoMatchRoot: a shared name across both files is auto-selected ---
{
  const app = loadApp();
  const gedA = `0 @I1@ INDI
1 NAME John /Smith/
0 @I2@ INDI
1 NAME Jane /Doe/
`;
  const gedB = `0 @P1@ INDI
1 NAME John /Smith/
0 @P2@ INDI
1 NAME Someone /Else/
`;
  app.loadGedcomFiles(gedA, gedB);
  app.maybeShowRootPanel();
  check(app._document.getElementById('rootPanel').style.display, 'block', 'the root panel is revealed once both files are loaded');
  check(app._document.getElementById('rootA').value, 'I1', 'tryAutoMatchRoot pre-selects the shared name on the File A side');
  check(app._document.getElementById('rootB').value, 'P1', 'tryAutoMatchRoot pre-selects the shared name on the File B side');
}

// --- No shared name anywhere: nothing is auto-selected, and no error is thrown ---
{
  const app = loadApp();
  const gedA = `0 @I1@ INDI
1 NAME John /Smith/
`;
  const gedB = `0 @P1@ INDI
1 NAME Someone /Else/
`;
  app.loadGedcomFiles(gedA, gedB);
  app.maybeShowRootPanel();
  check(app._document.getElementById('rootA').value, '', 'no auto-match: File A root select is left unselected');
  check(app._document.getElementById('rootB').value, '', 'no auto-match: File B root select is left unselected');
}

// --- Dropdown option formatting and filtering, plus one-way mirroring ---
{
  const app = loadApp();
  const gedA = `0 @I1@ INDI
1 NAME John /Smith/
1 BIRT
2 DATE 1900
0 @I2@ INDI
1 NAME Jane /Doe/
`;
  const gedB = `0 @P1@ INDI
1 NAME Someone /Else/
0 @P2@ INDI
1 NAME NoMatch /Person/
`;
  app.loadGedcomFiles(gedA, gedB);
  app.maybeShowRootPanel();
  check(app._document.getElementById('rootA').innerHTML.includes('John Smith &mdash; b.1900 [I1]') ||
        app._document.getElementById('rootA').innerHTML.includes('John Smith') && app._document.getElementById('rootA').innerHTML.includes('1900') && app._document.getElementById('rootA').innerHTML.includes('[I1]'),
    true, 'a birth year is included in the dropdown label alongside the GEDCOM id');

  app.onRootAFilterInput('John');
  check(app._document.getElementById('rootA').innerHTML.includes('John Smith'), true, 'filtering File A narrows its own dropdown');
  check(app._document.getElementById('rootA').innerHTML.includes('Jane Doe'), false, 'a non-matching File A option is excluded by the filter');
  check(app._document.getElementById('rootBFilter').value, 'John', "typing in File A's filter box live-mirrors into File B's filter box");
  // Neither File B name contains "john", so filterSelect's own fallback (show
  // everything rather than an empty list) kicks in.
  check(app._document.getElementById('rootB').innerHTML.includes('Someone Else') && app._document.getElementById('rootB').innerHTML.includes('NoMatch Person'),
    true, 'when the mirrored filter matches nothing in File B, its dropdown falls back to showing every option rather than none');

  app.onRootBFilterInput('Else');
  check(app._document.getElementById('rootB').innerHTML.includes('Someone Else'), true, 'editing File B\'s filter directly narrows its dropdown');
  check(app._document.getElementById('rootB').innerHTML.includes('NoMatch Person'), false, 'a non-matching File B option is excluded once filtered directly');

  app.onRootAFilterInput('Jane');
  check(app._document.getElementById('rootBFilter').value, 'John',
    "once the person has edited File B's filter directly, further typing in File A's filter no longer overwrites it");
  check(app._document.getElementById('rootB').innerHTML.includes('Someone Else'), true,
    "File B's dropdown is likewise undisturbed by File A's further filtering");
}

process.exit(summary('root-selection'));
