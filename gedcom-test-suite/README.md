# GEDCOM Tree Comparator — Test Suite

Unit tests for the logic behind `gedcom-compare.html` (the GEDCOM parser, the
ancestor/sibling/spouse matching, the descendant-generations feature, and the
date-exactness comparison rules). These run in plain Node.js — no browser needed —
by loading the app's JavaScript into a small sandboxed context with a stubbed-out
`document` object.

## Setup

Place `gedcom-compare.html` in the parent folder of this test suite, i.e.:

```
your-folder/
  gedcom-compare.html
  gedcom-test-suite/
    app.js              <- pre-generated from the HTML; already included
    harness.js
    extract-app-js.js
    run-tests.js
    tests/
      date-matching.test.js
      ancestor-dedup.test.js
      descendant-generations.test.js
      descendant-labels.test.js
```

`app.js` is already generated and included, so you can run the tests immediately.
If you (or Claude) ever edit `gedcom-compare.html`, regenerate it with:

```
node extract-app-js.js
```

## Running the tests

Run everything:

```
node run-tests.js
```

Or run a single test file directly:

```
node tests/date-matching.test.js
```

Each test file prints a `PASS`/`FAIL` line per case and a summary count, and exits
with a non-zero status code if anything failed (so it's CI-friendly if you ever
want to hook it into something).

## What's covered

- **date-matching.test.js** — the date exactness hierarchy: Exact > About > Year >
  Bef/Aft, including month-name normalization (Nov/November), the flat 3-month
  tolerance for approximate dates, and the rule that Bef/Aft dates only match an
  identical qualifier + date.
- **ancestor-dedup.test.js** — confirms a direct ancestor (e.g. the root's mother)
  is never repeated elsewhere in the report (e.g. as "Spouse" under the father's
  section).
- **descendant-generations.test.js** — confirms the "children of ancestors" option
  surfaces genuinely new people (like the root's own child) while staying correctly
  out of scope for collateral relatives (a sibling's child).
- **descendant-labels.test.js** — confirms generation labels through several levels:
  Child → Grandchild → Great-grandchild → Great-great-grandchild.

## Adding a new test

Add a new `tests/*.test.js` file following the same pattern (`require('../harness')`,
build a small GEDCOM fixture, call `loadApp()`, run `parseGedcom`/`runCompare`, and
`check()` the results). `run-tests.js` picks up any file automatically — no need to
register it anywhere.
