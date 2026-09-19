# GEDCOM Tree Comparator — Test Suite

Unit tests for the logic behind `GEDCOMparator.html` — the GEDCOM parser, WWW
link classification and the "Nearest WikiTree" fallback, ancestor/sibling/
spouse/descendant matching and de-duplication, the relationship-to-root
calculator, the genealogy-aware date-exactness rules, the "substantially
different" red/amber/green header logic, and every report-control filter
(hide exact matches, hide people likely still alive, hide people with no
birth date, treat similar locations as matching, only show missing, only
show significant differences, hide reviewed items, group by ancestor vs. show
every individual separately, and the collapse/expand controls). These run in
plain Node.js — no browser needed — by loading the app's inline `<script>`
into a small sandboxed `vm` context with a stubbed-out `document` object.

## Setup

Place `GEDCOMparator.html` in the **same folder** as `harness.js` and
`run-tests.js`, i.e.:

```
your-folder/
  GEDCOMparator.html
  harness.js
  run-tests.js
  tests/
    ambiguous-name-matching.test.js
    date-matching.test.js
    descendant-generations.test.js
    descendant-labels.test.js
    display-mode.test.js
    gedcom-parsing-and-links.test.js
    marriage-and-rendering.test.js
    matching-and-toggles.test.js
    only-significant.test.js
    place-similarity.test.js
    relationship-terms.test.js
    root-selection.test.js
    section-collapse.test.js
    section-status.test.js
    substantial-difference.test.js
    wikitree-fallback.test.js
```

`harness.js` reads `GEDCOMparator.html` directly at test-run time (it extracts
the inline `<script>` block itself — there's no separate pre-generated
`app.js` to keep in sync, so editing the HTML is immediately reflected the
next time you run the tests).

## Running the tests

Run everything:

```
node run-tests.js
```

Or run a single test file directly:

```
node tests/date-matching.test.js
```

Each test file prints a `PASS`/`FAIL` line per case and a summary count, and
exits with a non-zero status code if anything failed (so it's CI-friendly if
you ever want to hook it into something).

## What's covered

- **gedcom-parsing-and-links.test.js** — the GEDCOM parser: name parsing
  (given/surname/suffix), CONC (no separator) vs. CONT (newline)
  continuation, multiple FAMS tags, xref stripping, level-0 records that
  aren't INDI/FAM (HEAD, TRLR), and WWW-tag link classification (recognized
  genealogy domains, bare domains, non-http(s) schemes, unparseable URLs).
- **matching-and-toggles.test.js** — `matchLists`' two matching passes
  (exact name, then birth-year-only fallback when names don't match at all),
  and the three independent "include spouses of ancestors" / "include
  siblings of ancestors" / "include spouses of siblings" toggles (including
  the UI guard that disables/forces off sibling-spouses when siblings is
  unchecked).
- **ambiguous-name-matching.test.js** — when two individuals in one file
  share a name and birth year alone doesn't disambiguate them, the matcher
  tries death year next, and only ever offers a still-tied pair at "maybe"
  confidence rather than silently guessing.
- **date-matching.test.js** — the date exactness hierarchy: Exact > About >
  Year > Bef/Aft, month-name normalization (Nov/November), the flat 3-month
  tolerance for approximate dates, the rule that Bef/Aft dates only match an
  identical qualifier + date, and the tightening where an EXACT date on
  *either* side of a comparison gets zero tolerance (not just when both
  sides are exact).
- **ancestor-dedup** (see `descendant-generations.test.js`, which also
  covers this) — confirms a direct ancestor is never repeated elsewhere in
  the report.
- **descendant-generations.test.js** — the "children of ancestors" option
  surfaces genuinely new people while staying out of scope for collateral
  relatives (a sibling's child).
- **descendant-labels.test.js** — generation labels through several levels:
  Child → Grandchild → Great-grandchild → Great-great-grandchild.
- **relationship-terms.test.js** — the full relationship-to-root calculator:
  parents/grandparents/great-grandparents, children/grandchildren, siblings
  (full and the documented half-sibling approximation), aunts/uncles,
  nieces/nephews, Nth cousins (including "removed"), step-relations for an
  ancestor's spouse, and the higher-level `relationshipInfo()` wrapper's
  path descriptions.
- **wikitree-fallback.test.js** — the "Nearest WikiTree" tiered lookup
  (spouse > child > parent > deeper descendant), checked across both files
  at each tier before moving to the next, and the cross-file counterpart
  fallback (with its own refusal to guess at an ambiguous name collision).
- **place-similarity.test.js** — the Sørensen-Dice bigram similarity used
  for "treat similar locations as matching".
- **substantial-difference.test.js** — the red/green "substantially
  different" header flag: name differences beyond a couple of characters of
  spelling drift (ignoring extra/missing/reordered middle names), birth-year
  gaps over 10 years, unrelated birth places, the subset/superset location
  exception (e.g. "Torgau, Germany" vs. "Germany"), and that a blank field on
  one side is never treated as a conflict.
- **section-status.test.js** — the red/amber/green ancestor-section header
  status computed over every row in a section, and how it's excused by
  "treat similar locations as matching", "hide people likely still alive",
  "hide people with no date of birth", and being individually marked
  Reviewed.
- **section-collapse.test.js** — the collapse/expand chevron on each
  section, default-collapsed behavior, and the "Hide all sub-details" master
  checkbox.
- **display-mode.test.js** — "Group results by ancestor" vs. showing every
  individual as their own section (no nested match-card), confirming nobody
  is ever listed twice and that summary counts don't change with the display
  mode.
- **only-significant.test.js** — "Only show items with significant
  differences (red)", in both display modes, including that it doesn't
  change the summary counts and that it disables "Hide exact matches" while
  active.
- **marriage-and-rendering.test.js** — the extra Marriage date/place
  comparison rows added for a matched spouse pair, `renderValueCell`'s
  "dates recognized as equivalent" and "similar in both" annotations,
  `matchYearsSuffix`'s "(DoB-DoD)" formatting, and HTML-escaping safety for
  names containing markup-significant characters.
- **root-selection.test.js** — auto-matching a shared root name across both
  files, the root-person dropdown's filtering, and the one-way mirroring
  between the two filter boxes (File A's typing live-updates File B's, until
  the person edits File B's box directly).

## Adding a new test

Add a new `tests/*.test.js` file following the same pattern (`require('../harness')`,
build a small GEDCOM fixture — or, for functions that operate on already-parsed
data (`matchLists`, `findNearestWikiTreeUrl`, `relationshipFromUV`, ...), a
small hand-built data object is often simpler than a full GEDCOM fixture — call
`loadApp()`, run whichever function(s) you need, and `check()` the results).
`run-tests.js` picks up any file automatically — no need to register it
anywhere.

## How the harness works

`harness.js` runs the HTML's inline `<script>` inside a Node `vm` context
with a minimal stubbed `document` (just enough `getElementById(id).value` /
`.checked` / `.style` / `.innerHTML` / `.classList` plumbing for the app to
run its normal `runCompare()` / `renderReport()` flow without a real
browser). `loadApp(overrides)` seeds every checkbox/input to match the real
HTML's actual default `checked`/`value` attributes (so a test reflects true
default behavior unless it explicitly overrides a setting), then extracts
every top-level `function` from the script (`parseGedcom`, `datesMatch`,
`matchLists`, `relationshipFromUV`, `runCompare`, ...) onto the returned
`app` object, so tests can call them directly — e.g. `const { datesMatch } =
app;` or `app.runCompare()`.

Two things are worth knowing if you're extending the harness:

- Top-level `function` declarations become properties on the sandbox
  automatically, and `loadApp()` bridges all of them onto the returned `app`
  object.
- Top-level `let`/`const` state (`dataA`, `dataB`, `lastSections`,
  `collapsedSections`, `reviewedIds`, ...) does **not** become a sandbox
  property — that's normal JS lexical scoping, not a bug — but it stays live
  across separate `vm.runInContext` calls on the same context.
  `app.getVar('lastSections')` and `app.loadGedcomFiles(gedA, gedB)` both
  rely on this to read and write that state from outside the sandbox. If you
  need to mutate other top-level state directly in a test (as
  `section-collapse.test.js` and `section-status.test.js` do with
  `collapsedSections` and `reviewedIds`), use `app.getVar('someVar')` to read
  the live object (Sets/Maps can then be mutated in place) — there's
  currently no `setVar` helper since every existing test only ever needed to
  mutate an object already returned by `getVar`, not replace it outright.
