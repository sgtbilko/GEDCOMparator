// Covers a cluster of previously-untested rendering/comparison details:
//  - marriage date/place are compared and added as extra fieldDiffs rows for
//    a matched Spouse pair (findMarriageFam + the two pushed fieldDiffs)
//  - renderValueCell's two "same but worth flagging" annotations: dates that
//    match despite different raw text, and locations similar enough to be
//    waved through
//  - matchYearsSuffix's "(DoB-DoD)" formatting, including its '?' and
//    omit-entirely edge cases
//  - HTML special characters in a person's name are escaped in output, not
//    injected raw (esc/escapeHtml)
const { loadApp, check, summary } = require('../harness');

const app = loadApp();
const { renderValueCell, matchYearsSuffix, escapeHtml } = app;

// --- matchYearsSuffix ---
check(matchYearsSuffix({ birthDate: '1900', deathDate: '1980' }), ' (1900-1980)', 'both years known');
check(matchYearsSuffix({ birthDate: '1900', deathDate: '' }), ' (1900-?)', 'death year unknown becomes a "?"');
check(matchYearsSuffix({ birthDate: '', deathDate: '1980' }), ' (?-1980)', 'birth year unknown becomes a "?"');
check(matchYearsSuffix({ birthDate: '', deathDate: '' }), '', 'neither year known — suffix omitted entirely, not "(?-?)"');
check(matchYearsSuffix({ birthDate: 'ABT 1900', deathDate: '' }), ' (1900-?)', 'a qualified date still yields a plain year via extractYear');

// --- renderValueCell: dates that match despite different raw text ---
{
  const f = { a: '12 Nov 1900', b: '12 November 1900', same: true, type: 'date', similarity: 1 };
  const html = renderValueCell(f, false, 0.5);
  check(html.includes('dates recognized as equivalent'), true,
    'two dates that match but read differently get an explanatory note');
  check(html.includes('12 Nov 1900') && html.includes('12 November 1900'), true,
    'both original (differently-worded) date strings are shown, not just one');
}
// Genuinely identical text needs no such note.
{
  const f = { a: '1900', b: '1900', same: true, type: 'date', similarity: 1 };
  const html = renderValueCell(f, false, 0.5);
  check(html.includes('dates recognized as equivalent'), false, 'identical raw date text gets no "equivalent" note');
}

// --- renderValueCell: similar-location pass-through, gated by the toggle AND threshold ---
{
  const f = { a: 'Springfield, Illinois', b: 'Springfield, Illinois, USA', same: false, type: 'place', similarity: 0.7 };
  check(renderValueCell(f, true, 0.5).includes('similar in both'), true,
    'a place difference above the threshold, with the toggle on, is shown as "similar in both"');
  check(renderValueCell(f, false, 0.5).includes('diff-cell'), true,
    'the same difference is shown as a plain diff when the toggle is off');
  check(renderValueCell(f, true, 0.8).includes('diff-cell'), true,
    'the same difference is shown as a plain diff when it falls below a stricter threshold');
}

// --- marriage fieldDiffs rows for a matched Spouse pair ---
{
  const gedA = `0 @I1@ INDI
1 NAME Root /Person/
1 FAMS @F1@
0 @I2@ INDI
1 NAME Spouse /Person/
1 FAMS @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 MARR
2 DATE 12 Jun 1920
2 PLAC Boston, Massachusetts
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
1 MARR
2 DATE 12 Jun 1925
2 PLAC Springfield, Illinois
`;
  const a = loadApp({ rootA: 'I1', rootB: 'P1', maxGen: '1', hideExactMatches: false });
  a.loadGedcomFiles(gedA, gedB);
  a.runCompare();
  const rootSection = a.getVar('lastSections').find(s => s.label === 'Root');
  const spouseRow = rootSection.rows.find(r => r.role === 'Spouse');
  const marrDate = spouseRow.fieldDiffs.find(f => f.label === 'Marriage date');
  const marrPlace = spouseRow.fieldDiffs.find(f => f.label === 'Marriage place');
  check(!!marrDate && !!marrPlace, true, 'a matched Spouse pair gets extra Marriage date/place fieldDiffs rows');
  check(marrDate.same, false, '12 Jun 1920 vs 12 Jun 1925 (5 years apart, both exact) do not match');
  check(marrPlace.same, false, 'Boston vs Springfield are recorded as a genuine place difference');
  check(marrPlace.type, 'place', 'the marriage place row is typed "place" so the similar-locations toggle can apply to it too');
}
// Missing marriage record on one side falls back to blank/blank comparison
// rather than throwing.
{
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
  const gedB = gedA.replace(/@I(\d)@/g, '@P$1@').replace(/@F1@/g, '@G1@');
  const a = loadApp({ rootA: 'I1', rootB: 'P1', maxGen: '1', hideExactMatches: false });
  a.loadGedcomFiles(gedA, gedB);
  a.runCompare();
  const rootSection = a.getVar('lastSections').find(s => s.label === 'Root');
  const spouseRow = rootSection.rows.find(r => r.role === 'Spouse');
  const marrDate = spouseRow.fieldDiffs.find(f => f.label === 'Marriage date');
  check(marrDate.same, true, 'no MARR record on either side compares as blank == blank, not a crash or false diff');
}

// --- HTML-escaping safety: a name containing markup-significant characters
// is never injected into the rendered report unescaped ---
{
  const gedA = `0 @I1@ INDI
1 NAME <script>alert(1)</script> /"Quote"/
1 FAMS @F1@
0 @I2@ INDI
1 NAME Spouse /Person/
1 FAMS @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
`;
  const gedB = gedA.replace(/@I(\d)@/g, '@P$1@').replace(/@F1@/g, '@G1@');
  const a = loadApp({ rootA: 'I1', rootB: 'P1', maxGen: '1', hideExactMatches: false });
  a.loadGedcomFiles(gedA, gedB);
  a.runCompare();
  const html = a._document.getElementById('report').innerHTML;
  check(html.includes('<script>alert(1)</script>'), false, 'a literal <script> tag in a name is never emitted unescaped');
  check(html.includes('&lt;script&gt;'), true, 'it is HTML-escaped instead');
}
check(escapeHtml(`<b>&"'</b>`), '&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;', 'escapeHtml covers all five special characters');

process.exit(summary('marriage-and-rendering'));
