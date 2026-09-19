// Two areas that were only ever exercised as a side effect of other tests:
//  - matchLists' pass-2 fallback (same birth year, no name match — likely a
//    spelling variant not close enough for normalizeName to catch)
//  - the three independent "include spouses of ancestors" / "include
//    siblings of ancestors" / "include spouses of siblings" toggles, which
//    replaced v1's single combined toggle
const { loadApp, check, summary } = require('../harness');

const app = loadApp();
const { matchLists } = app;

function data(individuals) { return { individuals }; }
function ind(id, full, birthDate) {
  return { id, name: { given: full.split(' ')[0], surname: full.split(' ')[1] || '', full }, birth: { date: birthDate || '' }, death: { date: '' } };
}

// --- matchLists pass 1: exact name match narrows correctly (sanity) ---
{
  const dataA = data({ a1: ind('a1', 'John Smith', '1900') });
  const dataB = data({ b1: ind('b1', 'John Smith', '1900') });
  const result = matchLists(dataA, ['a1'], dataB, ['b1']);
  check(result.pairs, [{ aId: 'a1', bId: 'b1', confidence: 'match' }], 'pass 1: exact name + year match is confident');
}

// --- matchLists pass 2: same birth year, names don't match at all (a
// misspelling too large for normalizeName's punctuation/case stripping to
// bridge) — matched only when the birth-year candidate is unique, and always
// at 'maybe' confidence since the name itself gave no signal. ---
{
  const dataA = data({ a1: ind('a1', 'Jonathan Smyth', '1900') });
  const dataB = data({ b1: ind('b1', 'John Smith', '1900') });
  const result = matchLists(dataA, ['a1'], dataB, ['b1']);
  check(result.pairs, [{ aId: 'a1', bId: 'b1', confidence: 'maybe' }],
    'pass 2: unmatched names but a unique shared birth year — offered as "maybe"');
  check(result.missingInA, [], 'pass 2: the matched B individual is not also left in missingInA');
  check(result.missingInB, [], 'pass 2: the matched A individual is not also left in missingInB');
}

// --- matchLists pass 2: birth year shared by MORE than one candidate — too
// ambiguous even for a "maybe", so nobody is paired. ---
{
  const dataA = data({ a1: ind('a1', 'Jonathan Smyth', '1900') });
  const dataB = data({
    b1: ind('b1', 'John Smith', '1900'),
    b2: ind('b2', 'Jon Smithe', '1900')
  });
  const result = matchLists(dataA, ['a1'], dataB, ['b1', 'b2']);
  check(result.pairs, [], 'pass 2: birth year shared by two+ candidates is too ambiguous to pair at all');
  check(result.missingInB, ['a1'], 'pass 2: the unpaired A individual falls through to missingInB');
  check(result.missingInA.sort(), ['b1', 'b2'], 'pass 2: both unpaired B candidates fall through to missingInA');
}

// --- matchLists: no birth year at all on the A side skips pass 2 entirely ---
{
  const dataA = data({ a1: ind('a1', 'Jonathan Smyth', '') });
  const dataB = data({ b1: ind('b1', 'John Smith', '1900') });
  const result = matchLists(dataA, ['a1'], dataB, ['b1']);
  check(result.pairs, [], 'pass 2 never fires without a birth year on the A side to key off of');
}

// --- Include-toggles: each is independent and defaults matter ---
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
1 FAMS @FU@
0 @I5@ INDI
1 NAME AuntsHusband /Person/
1 FAMS @FU@
0 @I6@ INDI
1 NAME RootsSpouse /Person/
1 FAMS @FR@
0 @F1@ FAM
1 HUSB @I2@
1 WIFE @I3@
1 CHIL @I1@
0 @F2@ FAM
1 CHIL @I2@
1 CHIL @I4@
0 @FU@ FAM
1 HUSB @I5@
1 WIFE @I4@
0 @FR@ FAM
1 HUSB @I1@
1 WIFE @I6@
`;
const gedB = gedA.replace(/@I(\d)@/g, '@P$1@').replace(/@F(\w*)@/g, '@G$1@');

{
  // Default settings: ancestor spouses ON, siblings OFF (so sibling-spouses
  // never even gets a chance to matter).
  const a = loadApp({ rootA: 'I1', rootB: 'P1', maxGen: '2', hideExactMatches: false });
  a.loadGedcomFiles(gedA, gedB);
  a.runCompare();
  const rootSection = a.getVar('lastSections').find(s => s.label === 'Root');
  const fatherSection = a.getVar('lastSections').find(s => s.label === 'Father');
  check(rootSection.rows.some(r => r.role === 'Spouse'), true,
    'default: "include spouses of ancestors" is on, so root\'s own spouse appears');
  check(fatherSection.rows.some(r => r.role === 'Sibling'), false,
    'default: "include siblings of ancestors" is off, so Uncle never appears at all');
}

{
  // Turn off ancestor spouses: root's own spouse should disappear.
  const a = loadApp({ rootA: 'I1', rootB: 'P1', maxGen: '2', includeAncestorSpouses: false, hideExactMatches: false });
  a.loadGedcomFiles(gedA, gedB);
  a.runCompare();
  const rootSection = a.getVar('lastSections').find(s => s.label === 'Root');
  check(rootSection.rows.some(r => r.role === 'Spouse'), false,
    '"include spouses of ancestors" off removes root\'s own spouse row entirely');
}

{
  // Turn on siblings, but leave sibling-spouses off: Uncle appears, his
  // husband does not.
  const a = loadApp({ rootA: 'I1', rootB: 'P1', maxGen: '2', includeSiblings: true, includeSibSpouses: false, hideExactMatches: false });
  a.loadGedcomFiles(gedA, gedB);
  a.runCompare();
  const fatherSection = a.getVar('lastSections').find(s => s.label === 'Father');
  check(fatherSection.rows.some(r => r.role === 'Sibling'), true, 'siblings on: Uncle appears as a Sibling');
  check(fatherSection.rows.some(r => r.role === "Sibling's spouse"), false,
    'sibling-spouses still off: Uncle\'s husband does not appear');
}

{
  // Both siblings AND sibling-spouses on: Uncle's husband should now appear too.
  const a = loadApp({ rootA: 'I1', rootB: 'P1', maxGen: '2', includeSiblings: true, includeSibSpouses: true, hideExactMatches: false });
  a.loadGedcomFiles(gedA, gedB);
  a.runCompare();
  const fatherSection = a.getVar('lastSections').find(s => s.label === 'Father');
  check(fatherSection.rows.some(r => r.role === "Sibling's spouse"), true,
    'siblings AND sibling-spouses on: Uncle\'s husband appears');
}

{
  // Sibling-spouses checked but siblings OFF: runCompare() itself guards this
  // (the checkbox would be disabled/forced off in the real UI, but the guard
  // also protects a programmatic/inconsistent call like this one).
  const a = loadApp({ rootA: 'I1', rootB: 'P1', maxGen: '2', includeSiblings: false, includeSibSpouses: true, hideExactMatches: false });
  a.loadGedcomFiles(gedA, gedB);
  a.runCompare();
  const fatherSection = a.getVar('lastSections').find(s => s.label === 'Father');
  check(fatherSection.rows.some(r => r.role === "Sibling's spouse"), false,
    'includeSibSpouses is ignored when includeSiblings is off, even called programmatically');
}

// --- onIncludeSiblingsChange(): the UI wiring that disables/forces off the
// sibling-spouses checkbox whenever siblings themselves are unchecked ---
{
  const a = loadApp();
  const siblingsCb = a._document.getElementById('includeSiblings');
  const sibSpousesCb = a._document.getElementById('includeSibSpouses');
  siblingsCb.checked = true;
  sibSpousesCb.checked = true;
  sibSpousesCb.disabled = false;
  a.onIncludeSiblingsChange();
  check(sibSpousesCb.disabled, false, 'sibling-spouses checkbox is enabled while siblings is checked');
  check(sibSpousesCb.checked, true, 'sibling-spouses checkbox keeps its checked state while siblings is checked');

  siblingsCb.checked = false;
  a.onIncludeSiblingsChange();
  check(sibSpousesCb.disabled, true, 'unchecking siblings disables the sibling-spouses checkbox');
  check(sibSpousesCb.checked, false, 'unchecking siblings also forces sibling-spouses off, not just disabled');
}

process.exit(summary('matching-and-toggles'));
