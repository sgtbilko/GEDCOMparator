// Tests findNearestWikiTreeUrl's fixed tier order (spouse > child > parent >
// deeper descendant), checked across BOTH files at each tier before moving to
// the next, plus the cross-file counterpart fallback for a candidate whose own
// record has no WikiTree link but a same-named counterpart in the other file
// does. Built with small synthetic data objects (matching extractIndividual's
// shape) rather than GEDCOM text, since findNearestWikiTreeUrl operates
// directly on parsed data and doesn't need a real file round-trip.
const { loadApp, check, summary } = require('../harness');

const app = loadApp();
const { findNearestWikiTreeUrl } = app;

function ind(id, opts = {}) {
  return {
    id,
    name: { given: opts.given || id, surname: opts.surname || 'Test', full: `${opts.given || id} ${opts.surname || 'Test'}` },
    sex: opts.sex || '',
    birth: { date: opts.birthDate || '', place: '' },
    death: { date: '', place: '' },
    famc: opts.famc || [],
    fams: opts.fams || [],
    links: opts.links || []
  };
}
function wikiLink(n) { return [{ url: `https://www.wikitree.com/wiki/Person-${n}`, label: 'WikiTree' }]; }
function fam(id, husb, wife, chil) { return { id, husb: husb || null, wife: wife || null, chil: chil || [], marr: { date: '', place: '' } }; }
function emptyData() { return { individuals: {}, families: {} }; }

// --- Tier order: spouse beats child beats parent beats deeper descendant ---
{
  const dataA = emptyData();
  dataA.individuals.target = ind('target', { fams: ['F1'], famc: 'FP' in {} ? [] : [] });
  dataA.individuals.target.famc = ['FPARENT'];
  dataA.individuals.spouse = ind('spouse', { links: wikiLink(1) });
  dataA.individuals.kid = ind('kid');
  dataA.individuals.parent = ind('parent', { links: wikiLink(2) });
  dataA.families.F1 = fam('F1', 'target', 'spouse', ['kid']);
  dataA.families.FPARENT = fam('FPARENT', 'parent', null, ['target']);
  const dataB = emptyData();

  check(findNearestWikiTreeUrl(dataA, dataB, 'target', null), 'https://www.wikitree.com/wiki/Person-1',
    'spouse (tier 1) wins even though a parent (tier 3) also has a WikiTree link');
}

// --- No spouse link: falls through to child (tier 2) ---
{
  const dataA = emptyData();
  dataA.individuals.target = ind('target', { fams: ['F1'], famc: ['FPARENT'] });
  dataA.individuals.spouse = ind('spouse'); // no link
  dataA.individuals.kid = ind('kid', { links: wikiLink(3) });
  dataA.individuals.parent = ind('parent', { links: wikiLink(4) });
  dataA.families.F1 = fam('F1', 'target', 'spouse', ['kid']);
  dataA.families.FPARENT = fam('FPARENT', 'parent', null, ['target']);
  const dataB = emptyData();

  check(findNearestWikiTreeUrl(dataA, dataB, 'target', null), 'https://www.wikitree.com/wiki/Person-3',
    'falls through to a child (tier 2) when no spouse has a link, ahead of a parent (tier 3)');
}

// --- Nothing until a deeper descendant (tier 4) ---
{
  const dataA = emptyData();
  dataA.individuals.target = ind('target', { fams: ['F1'] });
  dataA.individuals.kid = ind('kid', { fams: ['F2'] });
  dataA.individuals.grandkid = ind('grandkid', { links: wikiLink(5) });
  dataA.families.F1 = fam('F1', 'target', null, ['kid']);
  dataA.families.F2 = fam('F2', 'kid', null, ['grandkid']);
  const dataB = emptyData();

  check(findNearestWikiTreeUrl(dataA, dataB, 'target', null), 'https://www.wikitree.com/wiki/Person-5',
    'falls all the way through to a grandchild (tier 4) when nothing closer has a link');
}

// --- A tier is checked across BOTH files before moving to the next ---
{
  const dataA = emptyData();
  dataA.individuals.target = ind('target', { fams: ['F1'] });
  dataA.individuals.kid = ind('kid', { links: wikiLink(6) }); // tier 2, File A
  dataA.families.F1 = fam('F1', 'target', null, ['kid']);

  const dataB = emptyData();
  dataB.individuals.targetB = ind('targetB', { fams: ['GF1'] });
  dataB.individuals.spouseB = ind('spouseB', { links: wikiLink(7) }); // tier 1, File B
  dataB.families.GF1 = fam('GF1', 'targetB', 'spouseB', []);

  check(findNearestWikiTreeUrl(dataA, dataB, 'target', 'targetB'), 'https://www.wikitree.com/wiki/Person-7',
    "a File B spouse (tier 1) wins over a File A child (tier 2) — tiers are compared across both files, not file-by-file");
}

// --- Cross-file counterpart fallback ---
{
  const dataA = emptyData();
  dataA.individuals.target = ind('target', { fams: ['F1'] });
  dataA.individuals.spouseA = ind('spouseA', { given: 'Jane', surname: 'Doe', birthDate: '1900' }); // no link of her own
  dataA.families.F1 = fam('F1', 'target', 'spouseA', []);

  const dataB = emptyData();
  // Jane Doe's counterpart in File B (same normalized name + birth year) DOES have a link.
  dataB.individuals.spouseB = ind('spouseB', { given: 'Jane', surname: 'Doe', birthDate: '1900', links: wikiLink(8) });

  check(findNearestWikiTreeUrl(dataA, dataB, 'target', null), 'https://www.wikitree.com/wiki/Person-8',
    "a spouse with no WikiTree link of her own still surfaces one via her counterpart in the other file");
}

// --- Cross-file counterpart lookup refuses an ambiguous name collision ---
{
  const dataA = emptyData();
  dataA.individuals.target = ind('target', { fams: ['F1'] });
  dataA.individuals.spouseA = ind('spouseA', { given: 'Jane', surname: 'Doe' }); // no birth year to disambiguate
  dataA.families.F1 = fam('F1', 'target', 'spouseA', []);

  const dataB = emptyData();
  dataB.individuals.jane1 = ind('jane1', { given: 'Jane', surname: 'Doe', links: wikiLink(9) });
  dataB.individuals.jane2 = ind('jane2', { given: 'Jane', surname: 'Doe' }); // a second, different Jane Doe

  check(findNearestWikiTreeUrl(dataA, dataB, 'target', null), null,
    'an ambiguous same-name counterpart (two candidates, no way to pick) is never guessed at');
}

// --- Nothing anywhere: null, not a thrown error ---
{
  const dataA = emptyData();
  dataA.individuals.lonely = ind('lonely');
  const dataB = emptyData();
  check(findNearestWikiTreeUrl(dataA, dataB, 'lonely', null), null, 'no WikiTree link anywhere in scope returns null, not an error');
}

process.exit(summary('wikitree-fallback'));
