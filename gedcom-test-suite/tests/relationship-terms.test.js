// Direct unit tests of the relationship-to-root calculator. relationshipFromUV
// and relationshipInfo are pure(ish) functions exposed by the app, so these
// are tested directly rather than via constructed GEDCOM topologies — that
// keeps this suite independent of which graph shapes the matching/dedup logic
// happens to make reachable (already covered by ancestor-dedup,
// descendant-generations and descendant-labels).
const { loadApp, check, summary } = require('../harness');

const app = loadApp();
const { relationshipFromUV, relationshipInfo, ordinal, greatPrefix, removedPhrase } = app;

// --- small helpers ---
check(ordinal(1), '1st', 'ordinal(1) = 1st');
check(ordinal(2), '2nd', 'ordinal(2) = 2nd');
check(ordinal(3), '3rd', 'ordinal(3) = 3rd');
check(ordinal(4), '4th', 'ordinal(4) = 4th');
check(ordinal(11), '11th', 'ordinal(11) = 11th (teen exception)');
check(ordinal(12), '12th', 'ordinal(12) = 12th (teen exception)');
check(ordinal(13), '13th', 'ordinal(13) = 13th (teen exception)');
check(ordinal(21), '21st', 'ordinal(21) = 21st (not a teen)');
check(greatPrefix(0), '', 'greatPrefix(0) is empty');
check(greatPrefix(1), 'great-', 'greatPrefix(1) is "great-"');
check(greatPrefix(2), '2x great-', 'greatPrefix(2) is "2x great-"');
check(removedPhrase(0), '', 'removedPhrase(0) is empty');
check(removedPhrase(1), ' once removed', 'removedPhrase(1)');
check(removedPhrase(2), ' twice removed', 'removedPhrase(2)');
check(removedPhrase(3), ' 3 times removed', 'removedPhrase(3)');

// --- direct ancestors (v === 0) ---
check(relationshipFromUV(1, 0, 'M', false), 'father', 'u1 v0 male: father');
check(relationshipFromUV(1, 0, 'F', false), 'mother', 'u1 v0 female: mother');
check(relationshipFromUV(2, 0, 'M', false), 'grandfather', 'u2 v0 male: grandfather');
check(relationshipFromUV(3, 0, 'F', false), 'great-grandmother', 'u3 v0 female: great-grandmother');
check(relationshipFromUV(4, 0, 'M', false), '2x great-grandfather', 'u4 v0 male: 2x great-grandfather');

// --- direct descendants (u === 0) ---
check(relationshipFromUV(0, 1, 'M'), 'son', 'u0 v1 male: son');
check(relationshipFromUV(0, 1, 'F'), 'daughter', 'u0 v1 female: daughter');
check(relationshipFromUV(0, 1, ''), 'child', 'u0 v1 unknown sex: child');
check(relationshipFromUV(0, 2, 'F'), 'granddaughter', 'u0 v2 female: granddaughter');
check(relationshipFromUV(0, 3, 'M'), 'great-grandson', 'u0 v3 male: great-grandson');

// --- siblings (minUV === 1, removed === 0) ---
check(relationshipFromUV(1, 1, 'M', false), 'brother', 'u1 v1 male, full: brother');
check(relationshipFromUV(1, 1, 'F', false), 'sister', 'u1 v1 female, full: sister');
check(relationshipFromUV(1, 1, '', false), 'sibling', 'u1 v1 unknown sex, full: sibling');
check(relationshipFromUV(1, 1, 'M', true), 'half-brother', 'u1 v1 male, half: half-brother');
check(relationshipFromUV(1, 1, 'F', true), 'half-sister', 'u1 v1 female, half: half-sister');

// --- aunts/uncles (minUV === 1, u > v) ---
check(relationshipFromUV(2, 1, 'M'), 'uncle', 'u2 v1 male: uncle');
check(relationshipFromUV(2, 1, 'F'), 'aunt', 'u2 v1 female: aunt');
check(relationshipFromUV(2, 1, ''), 'aunt/uncle', 'u2 v1 unknown sex: aunt/uncle');
check(relationshipFromUV(3, 1, 'M'), 'great-uncle', 'u3 v1 male: great-uncle');
check(relationshipFromUV(4, 1, 'F'), '2x great-aunt', 'u4 v1 female: 2x great-aunt');

// --- nieces/nephews (minUV === 1, u < v) ---
check(relationshipFromUV(1, 2, 'M'), 'nephew', 'u1 v2 male: nephew');
check(relationshipFromUV(1, 2, 'F'), 'niece', 'u1 v2 female: niece');
check(relationshipFromUV(1, 3, 'M'), 'grand-nephew', 'u1 v3 male: grand-nephew');
check(relationshipFromUV(1, 4, 'F'), 'great-grand-niece', 'u1 v4 female: great-grand-niece');

// --- cousins (minUV >= 2) ---
check(relationshipFromUV(2, 2, ''), '1st cousin', 'u2 v2: 1st cousin');
check(relationshipFromUV(3, 3, ''), '2nd cousin', 'u3 v3: 2nd cousin');
check(relationshipFromUV(4, 4, ''), '3rd cousin', 'u4 v4: 3rd cousin');
check(relationshipFromUV(2, 3, ''), '1st cousin once removed', 'u2 v3: 1st cousin once removed');
check(relationshipFromUV(3, 2, ''), '1st cousin once removed', 'u3 v2: 1st cousin once removed (order-symmetric)');
check(relationshipFromUV(2, 4, ''), '1st cousin twice removed', 'u2 v4: 1st cousin twice removed');
check(relationshipFromUV(3, 5, ''), '2nd cousin twice removed', 'u3 v5: 2nd cousin twice removed');

// --- root itself ---
check(relationshipFromUV(0, 0, ''), 'root', 'u0 v0: root');

// --- relationshipInfo(): the higher-level wrapper used per-row, including
// path descriptions built from lineageLabel() ---
check(relationshipInfo('Ancestor', '', 0, ''), { relationshipTerm: 'Root', pathDescription: null },
  'relationshipInfo: root ancestor row');
check(relationshipInfo('Ancestor', 'F', 0, ''), { relationshipTerm: 'Father', pathDescription: 'father' },
  'relationshipInfo: father ancestor row');
check(relationshipInfo('Ancestor', 'FF', 0, ''), { relationshipTerm: 'Grandfather', pathDescription: "father's father" },
  "relationshipInfo: paternal grandfather (father's father)");
check(relationshipInfo('Ancestor', 'MF', 0, ''), { relationshipTerm: 'Grandfather', pathDescription: "mother's father" },
  "relationshipInfo: mother's father is Grandfather (a father-link ancestor is always male, whichever branch it's reached through)");
check(relationshipInfo('Sibling', 'F', null, 'M'), { relationshipTerm: 'Uncle', pathDescription: "father's sibling" },
  "relationshipInfo: a male Sibling under Father's section is an Uncle");
check(relationshipInfo('Sibling', '', null, 'F'), { relationshipTerm: 'Sister', pathDescription: 'sibling' },
  "relationshipInfo: a female Sibling under the Root section is a Sister");
check(relationshipInfo('Spouse', '', null, 'F'), { relationshipTerm: 'Wife', pathDescription: 'spouse' },
  "relationshipInfo: root's own female Spouse is a Wife");
check(relationshipInfo('Spouse', 'F', null, 'F'), { relationshipTerm: 'Step-mother', pathDescription: "father's spouse" },
  "relationshipInfo: Father's Spouse (not the birth mother) is a Step-mother");
check(relationshipInfo("Sibling's spouse", 'F', null, ''), { relationshipTerm: 'Aunt/uncle', pathDescription: "father's sibling's spouse" },
  "relationshipInfo: an uncle's wife (Sibling's spouse) is Aunt/uncle by the same u/v math");
check(relationshipInfo('Child', '', 1, 'M'), { relationshipTerm: 'Son', pathDescription: 'child' },
  "relationshipInfo: Root's own Child descendant (u=0) is a Son, never 'half-'");
check(relationshipInfo('Child', 'F', 1, 'M'), { relationshipTerm: 'Half-brother', pathDescription: "father's child" },
  "relationshipInfo: Father's Child descendant at depth 1 (u=1,v=1) is labelled half- per the documented approximation");
check(relationshipInfo('Grandchild', 'F', 2, 'F'), { relationshipTerm: 'Niece', pathDescription: "father's grandchild" },
  "relationshipInfo: Father's Grandchild descendant (u=1,v=2) is a Niece");

process.exit(summary('relationship-terms'));
