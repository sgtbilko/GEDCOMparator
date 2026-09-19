// Direct unit tests for the GEDCOM parser (parseGedcom/extractIndividual/
// extractFamily/parseNameValue/concValue) and WWW-tag link classification
// (classifyWebLink/domainLabel) — the foundation everything else is built on,
// but previously only ever exercised indirectly through higher-level tests.
const { loadApp, check, summary } = require('../harness');

const app = loadApp();
const { parseGedcom, parseNameValue, classifyWebLink, domainLabel } = app;

// --- name parsing (given / surname / suffix) ---
check(parseNameValue('John /Smith/'), { given: 'John', surname: 'Smith', full: 'John Smith' },
  'plain given + surname');
check(parseNameValue('John Michael /Smith/'), { given: 'John Michael', surname: 'Smith', full: 'John Michael Smith' },
  'a middle name stays part of the given-name field, not split out separately');
check(parseNameValue('John /Smith/ Jr.'), { given: 'John', surname: 'Smith', full: 'John Smith Jr.' },
  'a suffix after the closing slash is appended to the full name');
check(parseNameValue('/Smith/'), { given: '', surname: 'Smith', full: 'Smith' },
  'surname only, no given name');
check(parseNameValue('Cher'), { given: 'Cher', surname: '', full: 'Cher' },
  'no slashes at all — treated as a bare given name');

// --- CONC (no separator) vs CONT (newline) continuation ---
{
  const ged = `0 @I1@ INDI
1 NAME John /Smith/
1 BIRT
2 PLAC Springfield,
3 CONC  Illinois,
3 CONT USA
`;
  const data = parseGedcom(ged);
  check(data.individuals.I1.birth.place, 'Springfield, Illinois,\nUSA',
    'CONC appends with no separator, CONT appends with a newline');
}

// --- multiple FAMS tags, xref @...@ stripping, and level-0 record routing ---
{
  const ged = `0 HEAD
1 SOUR TestExporter
0 @I1@ INDI
1 NAME Multi /Spouse/
1 FAMC @F1@
1 FAMS @F2@
1 FAMS @F3@
0 @F1@ FAM
1 CHIL @I1@
0 @F2@ FAM
1 HUSB @I1@
0 @F3@ FAM
1 HUSB @I1@
0 TRLR
`;
  const data = parseGedcom(ged);
  check(Object.keys(data.individuals), ['I1'], 'a non-INDI, non-FAM level-0 record (HEAD) is not mistaken for an individual');
  check(data.individuals.I1.famc, ['F1'], 'FAMC xref has its @...@ delimiters stripped');
  check(data.individuals.I1.fams, ['F2', 'F3'], 'multiple FAMS tags are all collected, in order');
  check(Object.keys(data.families).sort(), ['F1', 'F2', 'F3'], 'TRLR is not mistaken for a family record');
}

// --- SEX tag ---
{
  const ged = `0 @I1@ INDI
1 NAME No /Sex/
`;
  check(parseGedcom(ged).individuals.I1.sex, '', 'a person with no SEX tag gets an empty string, not undefined/null');
}

// --- WWW link classification ---
check(classifyWebLink('https://www.wikitree.com/wiki/Smith-123'),
  { url: 'https://www.wikitree.com/wiki/Smith-123', label: 'WikiTree' }, 'recognizes WikiTree, strips www.');
check(classifyWebLink('ancestry.com/profile/456'),
  { url: 'https://ancestry.com/profile/456', label: 'Ancestry' }, 'a bare domain (no scheme) is given https:// and recognized');
check(classifyWebLink('https://www.findagrave.com/memorial/1'), { url: 'https://www.findagrave.com/memorial/1', label: 'Find a Grave' },
  'recognizes Find a Grave');
check(classifyWebLink('https://obscure-family-site.example/tree/1'),
  { url: 'https://obscure-family-site.example/tree/1', label: 'obscure-family-site.example' },
  'an unrecognized domain falls back to showing the bare domain itself');
check(classifyWebLink('mailto:john@example.com'), null, 'a non-http(s) scheme (mailto:) is omitted, not guessed at');
check(classifyWebLink(''), null, 'a blank WWW value is omitted');
check(classifyWebLink('   '), null, 'a whitespace-only WWW value is omitted');
check(domainLabel('myheritage.co.uk'), 'MyHeritage', 'domainLabel matches a genealogy domain even with an extra TLD segment');
check(domainLabel('geni.com'), 'Geni', 'domainLabel recognizes Geni');

process.exit(summary('gedcom-parsing-and-links'));
