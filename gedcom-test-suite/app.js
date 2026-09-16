
let dataA = null, dataB = null;
let allOptionsA = [], allOptionsB = [];

document.getElementById('fileA').addEventListener('change', e => handleFile(e, 'A'));
document.getElementById('fileB').addEventListener('change', e => handleFile(e, 'B'));

function handleFile(e, which) {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('status' + which);
  statusEl.textContent = 'Reading…';
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = parseGedcom(ev.target.result);
      const count = Object.keys(parsed.individuals).length;
      if (which === 'A') dataA = parsed; else dataB = parsed;
      statusEl.textContent = `Loaded ${count} individuals.`;
      maybeShowRootPanel();
    } catch (err) {
      statusEl.textContent = 'Could not parse this file: ' + err.message;
    }
  };
  reader.onerror = () => { statusEl.textContent = 'Failed to read file.'; };
  reader.readAsText(file);
}

function maybeShowRootPanel() {
  if (!dataA || !dataB) return;
  document.getElementById('rootPanel').style.display = 'block';
  allOptionsA = buildOptionList(dataA);
  allOptionsB = buildOptionList(dataB);
  populateSelect('rootA', allOptionsA);
  populateSelect('rootB', allOptionsB);
  tryAutoMatchRoot();
}

function buildOptionList(data) {
  return Object.values(data.individuals)
    .map(ind => ({ id: ind.id, label: formatIndiLabel(ind) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function formatIndiLabel(ind) {
  const yr = ind.birth.date ? extractYear(ind.birth.date) : '';
  return `${ind.name.full || '(no name)'}${yr ? ' — b.' + yr : ''} [${ind.id}]`;
}

function populateSelect(selectId, options) {
  const sel = document.getElementById(selectId);
  sel.innerHTML = options.map(o => `<option value="${o.id}">${escapeHtml(o.label)}</option>`).join('');
}

function filterSelect(selectId, query) {
  const options = selectId === 'rootA' ? allOptionsA : allOptionsB;
  const q = query.toLowerCase();
  const filtered = options.filter(o => o.label.toLowerCase().includes(q));
  populateSelect(selectId, filtered.length ? filtered : options);
}

function tryAutoMatchRoot() {
  // naive: if any individual's normalized name matches exactly across both files, preselect the first pair
  const normA = {};
  allOptionsA.forEach(o => {
    const ind = dataA.individuals[o.id];
    normA[normalizeName(ind.name.full)] = o.id;
  });
  for (const o of allOptionsB) {
    const ind = dataB.individuals[o.id];
    const key = normalizeName(ind.name.full);
    if (normA[key]) {
      document.getElementById('rootA').value = normA[key];
      document.getElementById('rootB').value = o.id;
      return;
    }
  }
}

// ---------- GEDCOM parsing ----------

function parseGedcom(text) {
  const rawLines = text.split(/\r\n|\r|\n/);
  const records = []; // top-level records (level 0)
  const stack = []; // [{level, node}]
  let root = { level: -1, children: [] };
  stack.push({ level: -1, node: root });

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(/^(\d+)\s+(@[^@]+@\s+)?([A-Za-z0-9_]+)(?:\s(.*))?$/);
    if (!m) continue;
    const level = parseInt(m[1], 10);
    let xref = m[2] ? m[2].trim().replace(/@/g, '') : null;
    let tag = m[3];
    let value = m[4] || '';
    // GEDCOM sometimes puts xref after tag for level 0 records like "0 @I1@ INDI" already handled;
    // but also handle "0 HEAD" with no xref (fine, xref stays null)
    const node = { level, tag, xref, value, children: [] };

    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    const parent = stack[stack.length - 1].node;
    parent.children.push(node);
    stack.push({ level, node });
  }

  const individuals = {};
  const families = {};

  for (const node of root.children) {
    if (node.tag === 'INDI' && node.xref) {
      individuals[node.xref] = extractIndividual(node);
    } else if (node.tag === 'FAM' && node.xref) {
      families[node.xref] = extractFamily(node);
    }
  }

  return { individuals, families };
}

function concValue(node) {
  let val = node.value || '';
  for (const child of node.children) {
    if (child.tag === 'CONC') val += (child.value || '');
    else if (child.tag === 'CONT') val += '\n' + (child.value || '');
  }
  return val;
}

function findChild(node, tag) {
  return node.children.find(c => c.tag === tag);
}
function findChildren(node, tag) {
  return node.children.filter(c => c.tag === tag);
}

function extractEvent(node, tag) {
  const evt = findChild(node, tag);
  if (!evt) return { date: '', place: '' };
  const dateNode = findChild(evt, 'DATE');
  const placeNode = findChild(evt, 'PLAC');
  return {
    date: dateNode ? concValue(dateNode).trim() : '',
    place: placeNode ? concValue(placeNode).trim() : ''
  };
}

function parseNameValue(raw) {
  const parts = raw.split('/');
  const given = (parts[0] || '').trim();
  const surname = (parts[1] || '').trim();
  const suffix = (parts[2] || '').trim();
  const full = [given, surname].filter(Boolean).join(' ') + (suffix ? ' ' + suffix : '');
  return { given, surname, full: full.trim() || raw.trim() };
}

function extractIndividual(node) {
  const nameNode = findChild(node, 'NAME');
  const name = nameNode ? parseNameValue(concValue(nameNode)) : { given: '', surname: '', full: '' };
  const sexNode = findChild(node, 'SEX');
  const famcNodes = findChildren(node, 'FAMC');
  const famsNodes = findChildren(node, 'FAMS');
  return {
    id: node.xref,
    name,
    sex: sexNode ? (sexNode.value || '').trim() : '',
    birth: extractEvent(node, 'BIRT'),
    death: extractEvent(node, 'DEAT'),
    famc: famcNodes.map(n => (n.value || '').replace(/@/g, '')),
    fams: famsNodes.map(n => (n.value || '').replace(/@/g, ''))
  };
}

function extractFamily(node) {
  const husb = findChild(node, 'HUSB');
  const wife = findChild(node, 'WIFE');
  const chilNodes = findChildren(node, 'CHIL');
  return {
    id: node.xref,
    husb: husb ? (husb.value || '').replace(/@/g, '') : null,
    wife: wife ? (wife.value || '').replace(/@/g, '') : null,
    chil: chilNodes.map(n => (n.value || '').replace(/@/g, '')),
    marr: extractEvent(node, 'MARR')
  };
}

// ---------- Tree navigation ----------

function getParents(data, indiId) {
  const ind = data.individuals[indiId];
  if (!ind || !ind.famc.length) return { father: null, mother: null };
  const fam = data.families[ind.famc[0]];
  if (!fam) return { father: null, mother: null };
  return { father: fam.husb, mother: fam.wife };
}

function getSiblings(data, indiId) {
  const ind = data.individuals[indiId];
  if (!ind || !ind.famc.length) return [];
  const fam = data.families[ind.famc[0]];
  if (!fam) return [];
  return fam.chil.filter(id => id !== indiId && data.individuals[id]);
}

function getSpousesWithMarriage(data, indiId) {
  const ind = data.individuals[indiId];
  if (!ind) return [];
  const result = [];
  for (const famId of ind.fams) {
    const fam = data.families[famId];
    if (!fam) continue;
    const spouseId = fam.husb === indiId ? fam.wife : (fam.wife === indiId ? fam.husb : null);
    if (spouseId && data.individuals[spouseId]) {
      result.push({ spouseId, marr: fam.marr });
    }
  }
  return result;
}

function getChildren(data, indiId) {
  const ind = data.individuals[indiId];
  if (!ind) return [];
  const seen = new Set();
  for (const famId of ind.fams) {
    const fam = data.families[famId];
    if (!fam) continue;
    for (const c of fam.chil) {
      if (data.individuals[c]) seen.add(c);
    }
  }
  return Array.from(seen);
}

function descendantLabel(genIndex) {
  if (genIndex === 1) return 'Child';
  if (genIndex === 2) return 'Grandchild';
  return 'Great-' + 'great-'.repeat(genIndex - 3) + 'grandchild';
}

function buildLineage(data, rootId, maxGen) {
  const nodes = {}; // code -> indiId
  function recurse(indiId, code, gen) {
    if (!data.individuals[indiId]) return;
    nodes[code] = indiId;
    if (gen >= maxGen) return;
    const { father, mother } = getParents(data, indiId);
    if (father) recurse(father, code + 'F', gen + 1);
    if (mother) recurse(mother, code + 'M', gen + 1);
  }
  recurse(rootId, '', 0);
  return nodes;
}

function lineageLabel(code) {
  if (code === '') return 'Root';
  const last = code[code.length - 1];
  const rest = code.slice(0, -1);
  const term = last === 'F' ? 'father' : 'mother';
  if (rest === '') return capitalize(term);
  return lineageLabel(rest) + "'s " + term;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ---------- Matching helpers ----------

function normalizeName(name) {
  return (name || '').toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

function extractYear(dateStr) {
  const m = (dateStr || '').match(/\d{4}/);
  return m ? m[0] : '';
}

function matchLists(dataA, listA, dataB, listB) {
  // listA/listB are arrays of individual IDs (in their respective files)
  const remainingB = listB.slice();
  const pairs = [];

  // pass 1: exact normalized name match, prefer matching birth year
  for (const aId of listA.slice()) {
    const aInd = dataA.individuals[aId];
    const aName = normalizeName(aInd.name.full);
    const aYear = extractYear(aInd.birth.date);
    let candidates = remainingB.filter(bId => normalizeName(dataB.individuals[bId].name.full) === aName);
    if (candidates.length > 1 && aYear) {
      const withYear = candidates.filter(bId => extractYear(dataB.individuals[bId].birth.date) === aYear);
      if (withYear.length) candidates = withYear;
    }
    if (candidates.length) {
      const bId = candidates[0];
      pairs.push({ aId, bId, confidence: 'match' });
      remainingB.splice(remainingB.indexOf(bId), 1);
      listA.splice(listA.indexOf(aId), 1);
    }
  }

  // pass 2: same birth year, no name match (possible spelling variants) -- only if unique
  for (const aId of listA.slice()) {
    const aInd = dataA.individuals[aId];
    const aYear = extractYear(aInd.birth.date);
    if (!aYear) continue;
    const candidates = remainingB.filter(bId => extractYear(dataB.individuals[bId].birth.date) === aYear);
    if (candidates.length === 1) {
      const bId = candidates[0];
      pairs.push({ aId, bId, confidence: 'maybe' });
      remainingB.splice(remainingB.indexOf(bId), 1);
      listA.splice(listA.indexOf(aId), 1);
    }
  }

  const missingInB = listA.slice(); // left in A, unmatched
  const missingInA = remainingB.slice(); // left in B, unmatched

  return { pairs, missingInB, missingInA };
}

// ---------- Comparison ----------

function normVal(v) { return (v || '').toString().trim(); }

function fieldsEqual(a, b) {
  return normVal(a).toLowerCase() === normVal(b).toLowerCase();
}

// Sørensen–Dice bigram similarity, used for "treat similar locations as matching".
// Returns 1 for identical strings, 0 for completely different, in between otherwise.
function normalizePlace(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s,]/g, '').replace(/\s+/g, ' ').trim();
}
function bigrams(s) {
  const out = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.substr(i, 2));
  return out;
}
function placeSimilarity(a, b) {
  const na = normalizePlace(a), nb = normalizePlace(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const bgA = bigrams(na), bgB = bigrams(nb).slice();
  if (!bgA.length || !bgB.length) return na === nb ? 1 : 0;
  let matches = 0;
  for (const bg of bgA) {
    const idx = bgB.indexOf(bg);
    if (idx !== -1) { matches++; bgB.splice(idx, 1); }
  }
  return (2 * matches) / (bigrams(na).length + bigrams(nb).length);
}
// Default only — the active threshold is read live from the slider in renderReport.

// ---------- Genealogy date comparison ----------
// Hierarchy of exactness: EXACT (full day/month/year) > ABOUT (ABT-qualified, or
// missing the day) > YEAR (bare year only) > BEFAFT (Bef/Aft-qualified — open-ended).
const MONTH_NAMES = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12
};
function monthNameToNum(s) {
  return MONTH_NAMES[s.toLowerCase().replace(/\.$/, '')] || null;
}

function parseGenealogyDate(raw) {
  let s = normVal(raw);
  if (!s) return null;
  let qualifier = null;
  let m = s.match(/^(abt|about|circa|cal|est)\.?\s+(.*)$/i);
  if (m) { qualifier = 'ABT'; s = m[2].trim(); }
  else if ((m = s.match(/^(bef|before)\.?\s+(.*)$/i))) { qualifier = 'BEF'; s = m[2].trim(); }
  else if ((m = s.match(/^(aft|after)\.?\s+(.*)$/i))) { qualifier = 'AFT'; s = m[2].trim(); }
  if (!s) return null;

  let day = null, month = null, year = null, mm;
  if ((mm = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{3,4})$/))) {
    day = parseInt(mm[1], 10);
    month = monthNameToNum(mm[2]);
    year = parseInt(mm[3], 10);
    if (!month) return null;
  } else if ((mm = s.match(/^([A-Za-z]+)\.?\s+(\d{3,4})$/))) {
    month = monthNameToNum(mm[1]);
    year = parseInt(mm[2], 10);
    if (!month) return null;
  } else if ((mm = s.match(/^(\d{3,4})$/))) {
    year = parseInt(mm[1], 10);
  } else {
    return null; // unrecognized format (ranges, quarters, etc.) — caller falls back to a plain string compare
  }

  let tier;
  if (qualifier === 'BEF' || qualifier === 'AFT') tier = 'BEFAFT';
  else if (qualifier === 'ABT') tier = 'ABOUT';
  else if (day && month) tier = 'EXACT';
  else if (month && !day) tier = 'ABOUT'; // month+year with no day counts as approximate
  else tier = 'YEAR';

  return { tier, qualifier, year, month, day };
}

function dateMidpointDays(p) {
  const mo = p.month ? p.month - 1 : 5; // no month known -> assume mid-year (June)
  const da = p.day ? p.day : 15;
  return Date.UTC(p.year, mo, da) / 86400000;
}

// Two dates match when:
//  - both are Bef/Aft-qualified with the same qualifier (Bef with Bef, Aft with Aft) AND the
//    same underlying date — since a vague Bef/Aft value should be tightened to the most
//    restrictive known date rather than treated as interchangeable with a different one, or
//  - exactly one is Bef/Aft-qualified -> never a match (precision isn't comparable), or
//  - otherwise, a flat 3-month (91 day) tolerance applies whenever either side isn't a full
//    exact date; two exact dates must match to the day.
function datesMatch(rawA, rawB) {
  const a = normVal(rawA), b = normVal(rawB);
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.toLowerCase() === b.toLowerCase()) return true;
  const pa = parseGenealogyDate(a), pb = parseGenealogyDate(b);
  if (!pa || !pb) return fieldsEqual(a, b);
  const aIsBefAft = pa.tier === 'BEFAFT', bIsBefAft = pb.tier === 'BEFAFT';
  if (aIsBefAft && bIsBefAft) {
    return pa.qualifier === pb.qualifier &&
      pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
  }
  if (aIsBefAft !== bIsBefAft) return false;
  const bothExact = pa.tier === 'EXACT' && pb.tier === 'EXACT';
  const tolerance = bothExact ? 0 : 91;
  return Math.abs(dateMidpointDays(pa) - dateMidpointDays(pb)) <= tolerance;
}

function compareIndividuals(indA, indB) {
  const fields = [
    ['Name', indA.name.full, indB.name.full, 'text'],
    ['Birth date', indA.birth.date, indB.birth.date, 'date'],
    ['Birth place', indA.birth.place, indB.birth.place, 'place'],
    ['Death date', indA.death.date, indB.death.date, 'date'],
    ['Death place', indA.death.place, indB.death.place, 'place']
  ];
  return fields.map(([label, a, b, type]) => {
    const same = type === 'date' ? datesMatch(a, b) : fieldsEqual(a, b);
    const similarity = type === 'place' ? placeSimilarity(a, b) : (same ? 1 : 0);
    return { label, a, b, same, type, similarity };
  });
}

function findMarriageFam(data, indiId, spouseId) {
  const ind = data.individuals[indiId];
  for (const famId of ind.fams) {
    const fam = data.families[famId];
    if (fam && (fam.husb === spouseId || fam.wife === spouseId)) return fam;
  }
  return null;
}

// ---------- Report rendering ----------

function esc(s) { return escapeHtml(s || ''); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderValueCell(f, ignoreSimilarLocations, locationThreshold) {
  const { a, b, same, type, similarity } = f;
  if (same) {
    const rawA = normVal(a), rawB = normVal(b);
    if (type === 'date' && rawA && rawB && rawA.toLowerCase() !== rawB.toLowerCase()) {
      return `<span class="similar-cell">A: ${esc(a)} · B: ${esc(b)} <span class="similar-note">(dates recognized as equivalent)</span></span>`;
    }
    const val = rawA || rawB;
    return `<span class="same-cell">${val ? esc(val) : '<span class="empty-val">—</span>'}</span>`;
  }
  if (ignoreSimilarLocations && type === 'place' && similarity >= locationThreshold) {
    const val = normVal(a) || normVal(b);
    return `<span class="similar-cell">${esc(val)} <span class="similar-note">(similar in both — treated as a match)</span></span>`;
  }
  const aVal = normVal(a) ? esc(a) : '<span class="empty-val">(blank)</span>';
  const bVal = normVal(b) ? esc(b) : '<span class="empty-val">(blank)</span>';
  return `<span class="diff-cell"><span class="a">A: ${aVal}</span><br><span class="b">B: ${bVal}</span></span>`;
}

function runCompare() {
  const rootA = document.getElementById('rootA').value;
  const rootB = document.getElementById('rootB').value;
  const maxGen = parseInt(document.getElementById('maxGen').value, 10) || 6;
  const includeSibSpouses = document.getElementById('includeSibSpouses').checked;
  const descendantGen = parseInt(document.getElementById('descendantGen').value, 10) || 0;

  const lineageA = buildLineage(dataA, rootA, maxGen);
  const lineageB = buildLineage(dataB, rootB, maxGen);

  // Anyone who already has their own ancestor section, or who has already been
  // listed anywhere else in the report, is never listed again elsewhere.
  const ancestorIdsA = new Set(Object.values(lineageA).filter(Boolean));
  const ancestorIdsB = new Set(Object.values(lineageB).filter(Boolean));
  const shownIdsA = new Set();
  const shownIdsB = new Set();
  function isAlreadyCovered(aId, bId) {
    return (!!aId && (ancestorIdsA.has(aId) || shownIdsA.has(aId))) ||
           (!!bId && (ancestorIdsB.has(bId) || shownIdsB.has(bId)));
  }
  function markShown(aId, bId) {
    if (aId) shownIdsA.add(aId);
    if (bId) shownIdsB.add(bId);
  }

  const allCodes = Array.from(new Set([...Object.keys(lineageA), ...Object.keys(lineageB)]));
  allCodes.sort((c1, c2) => c1.length - c2.length || c1.localeCompare(c2));

  let totalMissingA = 0, totalMissingB = 0;
  const sections = [];

  for (const code of allCodes) {
    const idA = lineageA[code];
    const idB = lineageB[code];
    const rows = [];

    // --- the ancestor at this position ---
    if (idA && idB) {
      const indA = dataA.individuals[idA];
      const indB = dataB.individuals[idB];
      const fieldDiffs = compareIndividuals(indA, indB);
      rows.push({ role: 'Ancestor', status: 'both', name: indA.name.full || indB.name.full, fieldDiffs });
      markShown(idA, idB);
    } else if (idA) {
      totalMissingB++;
      rows.push(missingRow('Ancestor', 'missB', dataA.individuals[idA]));
      markShown(idA, null);
    } else if (idB) {
      totalMissingA++;
      rows.push(missingRow('Ancestor', 'missA', dataB.individuals[idB]));
      markShown(null, idB);
    } else {
      continue;
    }

    // --- siblings ---
    const sibsA = idA ? getSiblings(dataA, idA) : [];
    const sibsB = idB ? getSiblings(dataB, idB) : [];
    const sibMatch = matchLists(dataA, sibsA.slice(), dataB, sibsB.slice());

    for (const pair of sibMatch.pairs) {
      if (isAlreadyCovered(pair.aId, pair.bId)) continue;
      const indA = dataA.individuals[pair.aId];
      const indB = dataB.individuals[pair.bId];
      const fieldDiffs = compareIndividuals(indA, indB);
      rows.push({
        role: 'Sibling', status: pair.confidence === 'maybe' ? 'maybe' : 'both',
        name: indA.name.full || indB.name.full, fieldDiffs
      });
      markShown(pair.aId, pair.bId);
    }
    for (const aId of sibMatch.missingInB) {
      if (isAlreadyCovered(aId, null)) continue;
      totalMissingB++;
      rows.push(missingRow('Sibling', 'missB', dataA.individuals[aId]));
      markShown(aId, null);
    }
    for (const bId of sibMatch.missingInA) {
      if (isAlreadyCovered(null, bId)) continue;
      totalMissingA++;
      rows.push(missingRow('Sibling', 'missA', dataB.individuals[bId]));
      markShown(null, bId);
    }

    // --- spouses of the ancestor ---
    const spousesA = idA ? getSpousesWithMarriage(dataA, idA).map(s => s.spouseId) : [];
    const spousesB = idB ? getSpousesWithMarriage(dataB, idB).map(s => s.spouseId) : [];
    const spouseMatch = matchLists(dataA, spousesA.slice(), dataB, spousesB.slice());

    for (const pair of spouseMatch.pairs) {
      if (isAlreadyCovered(pair.aId, pair.bId)) continue;
      const indA = dataA.individuals[pair.aId];
      const indB = dataB.individuals[pair.bId];
      const fieldDiffs = compareIndividuals(indA, indB);
      // add marriage comparison
      const famA = idA ? findMarriageFam(dataA, idA, pair.aId) : null;
      const famB = idB ? findMarriageFam(dataB, idB, pair.bId) : null;
      const marrA = famA ? famA.marr : { date: '', place: '' };
      const marrB = famB ? famB.marr : { date: '', place: '' };
      fieldDiffs.push({ label: 'Marriage date', a: marrA.date, b: marrB.date, same: datesMatch(marrA.date, marrB.date), type: 'date', similarity: datesMatch(marrA.date, marrB.date) ? 1 : 0 });
      fieldDiffs.push({ label: 'Marriage place', a: marrA.place, b: marrB.place, same: fieldsEqual(marrA.place, marrB.place), type: 'place', similarity: placeSimilarity(marrA.place, marrB.place) });
      rows.push({
        role: 'Spouse', status: pair.confidence === 'maybe' ? 'maybe' : 'both',
        name: indA.name.full || indB.name.full, fieldDiffs
      });
      markShown(pair.aId, pair.bId);
    }
    for (const aId of spouseMatch.missingInB) {
      if (isAlreadyCovered(aId, null)) continue;
      totalMissingB++;
      rows.push(missingRow('Spouse', 'missB', dataA.individuals[aId]));
      markShown(aId, null);
    }
    for (const bId of spouseMatch.missingInA) {
      if (isAlreadyCovered(null, bId)) continue;
      totalMissingA++;
      rows.push(missingRow('Spouse', 'missA', dataB.individuals[bId]));
      markShown(null, bId);
    }

    // --- optionally spouses of siblings ---
    if (includeSibSpouses) {
      for (const pair of sibMatch.pairs) {
        addSiblingSpouseRows(pair.aId, pair.bId, rows);
      }
      for (const aId of sibMatch.missingInB) addSiblingSpouseRows(aId, null, rows);
      for (const bId of sibMatch.missingInA) addSiblingSpouseRows(null, bId, rows);
    }

    function addSiblingSpouseRows(sibAId, sibBId, rows) {
      const spA = sibAId ? getSpousesWithMarriage(dataA, sibAId).map(s => s.spouseId) : [];
      const spB = sibBId ? getSpousesWithMarriage(dataB, sibBId).map(s => s.spouseId) : [];
      const m = matchLists(dataA, spA.slice(), dataB, spB.slice());
      for (const pair of m.pairs) {
        if (isAlreadyCovered(pair.aId, pair.bId)) continue;
        const indA = dataA.individuals[pair.aId];
        const indB = dataB.individuals[pair.bId];
        const fieldDiffs = compareIndividuals(indA, indB);
        rows.push({ role: "Sibling's spouse", status: pair.confidence === 'maybe' ? 'maybe' : 'both', name: indA.name.full || indB.name.full, fieldDiffs });
        markShown(pair.aId, pair.bId);
      }
      for (const aId of m.missingInB) {
        if (isAlreadyCovered(aId, null)) continue;
        totalMissingB++; rows.push(missingRow("Sibling's spouse", 'missB', dataA.individuals[aId]));
        markShown(aId, null);
      }
      for (const bId of m.missingInA) {
        if (isAlreadyCovered(null, bId)) continue;
        totalMissingA++; rows.push(missingRow("Sibling's spouse", 'missA', dataB.individuals[bId]));
        markShown(null, bId);
      }
    }

    // --- optionally, descendants (children) of this ancestor, N generations deep ---
    if (descendantGen > 0) {
      addDescendantRows(idA, idB, descendantGen, 1, rows);
    }

    function addDescendantRows(aId, bId, depthRemaining, genIndex, rows) {
      if (depthRemaining <= 0) return;
      const childrenA = aId ? getChildren(dataA, aId) : [];
      const childrenB = bId ? getChildren(dataB, bId) : [];
      const candA = childrenA.filter(id => !isAlreadyCovered(id, null));
      const candB = childrenB.filter(id => !isAlreadyCovered(null, id));
      const m = matchLists(dataA, candA.slice(), dataB, candB.slice());
      const label = descendantLabel(genIndex);

      for (const pair of m.pairs) {
        const indA = dataA.individuals[pair.aId];
        const indB = dataB.individuals[pair.bId];
        const fieldDiffs = compareIndividuals(indA, indB);
        rows.push({ role: label, status: pair.confidence === 'maybe' ? 'maybe' : 'both', name: indA.name.full || indB.name.full, fieldDiffs });
        markShown(pair.aId, pair.bId);
        addDescendantRows(pair.aId, pair.bId, depthRemaining - 1, genIndex + 1, rows);
      }
      for (const id of m.missingInB) {
        totalMissingB++;
        rows.push(missingRow(label, 'missB', dataA.individuals[id]));
        markShown(id, null);
        addDescendantRows(id, null, depthRemaining - 1, genIndex + 1, rows);
      }
      for (const id of m.missingInA) {
        totalMissingA++;
        rows.push(missingRow(label, 'missA', dataB.individuals[id]));
        markShown(null, id);
        addDescendantRows(null, id, depthRemaining - 1, genIndex + 1, rows);
      }
    }

    sections.push({ code, label: lineageLabel(code), gen: code.length, rows });
  }

  lastSections = sections;
  document.getElementById('reportControls').style.display = 'flex';
  renderReport();
}

function missingRow(role, status, indi) {
  return {
    role, status, name: indi.name.full, fieldDiffs: null,
    birthDate: indi.birth.date, deathDate: indi.death.date
  };
}

// A missing person is treated as "likely still alive" only when we have a birth year,
// there's no recorded death, and that birth year is within the given number of years.
function isLikelyAlive(row, maxYears) {
  if (normVal(row.deathDate)) return false;
  const yr = extractYear(row.birthDate);
  if (!yr) return false;
  const age = new Date().getFullYear() - parseInt(yr, 10);
  return age >= 0 && age <= maxYears;
}

// Whether a matched row still counts as "different" once the active filters are applied.
function rowHasEffectiveDiff(row, ignoreSimilarLocations, locationThreshold) {
  if (!row.fieldDiffs) return true;
  return row.fieldDiffs.some(f => {
    if (f.same) return false;
    if (ignoreSimilarLocations && f.type === 'place' && f.similarity >= locationThreshold) return false;
    return true;
  });
}

function statusBadge(status) {
  if (status === 'both') return '<span class="badge both">In both</span>';
  if (status === 'missA') return '<span class="badge missA">Missing in File A</span>';
  if (status === 'missB') return '<span class="badge missB">Missing in File B</span>';
  if (status === 'maybe') return '<span class="badge maybe">Possible match — verify</span>';
  return '';
}

let lastSections = null;

function onFilterChange() {
  renderReport();
}

function renderReport() {
  if (!lastSections) return;
  const el = document.getElementById('report');

  const hideExactMatches = document.getElementById('hideExactMatches').checked;
  const ignoreAliveMissing = document.getElementById('ignoreAliveMissing').checked;
  const ignoreSimilarLocations = document.getElementById('ignoreSimilarLocations').checked;
  const aliveYears = parseInt(document.getElementById('aliveYears').value, 10);
  const locationThresholdPct = parseInt(document.getElementById('locationThreshold').value, 10);
  const locationThreshold = locationThresholdPct / 100;
  document.getElementById('aliveYearsVal').textContent = aliveYears;
  document.getElementById('locationThresholdVal').textContent = locationThresholdPct + '%';

  let totalCompared = 0, totalWithDiffs = 0, totalMissingA = 0, totalMissingB = 0;
  let hiddenExact = 0, hiddenAlive = 0;
  const visibleSections = [];

  for (const section of lastSections) {
    const visibleRows = [];
    for (const row of section.rows) {
      if (row.status === 'missA' || row.status === 'missB') {
        if (ignoreAliveMissing && isLikelyAlive(row, aliveYears)) { hiddenAlive++; continue; }
        if (row.status === 'missA') totalMissingA++; else totalMissingB++;
        visibleRows.push(row);
        continue;
      }
      // status is 'both' or 'maybe'
      const hasDiff = rowHasEffectiveDiff(row, ignoreSimilarLocations, locationThreshold);
      totalCompared++;
      if (hasDiff) totalWithDiffs++;
      if (hideExactMatches && !hasDiff) { hiddenExact++; continue; }
      visibleRows.push(row);
    }
    if (visibleRows.length) visibleSections.push({ ...section, rows: visibleRows });
  }

  let html = '';

  html += `<div class="summary">
    <div class="card"><div class="num">${totalCompared}</div><div class="lbl">Individuals matched &amp; compared</div></div>
    <div class="card"><div class="num">${totalWithDiffs}</div><div class="lbl">Matched with attribute differences</div></div>
    <div class="card"><div class="num">${totalMissingA}</div><div class="lbl">Missing from File A shown</div></div>
    <div class="card"><div class="num">${totalMissingB}</div><div class="lbl">Missing from File B shown</div></div>
  </div>`;

  if (hideExactMatches || ignoreAliveMissing) {
    const bits = [];
    if (hideExactMatches) bits.push(`${hiddenExact} exact match${hiddenExact === 1 ? '' : 'es'} hidden`);
    if (ignoreAliveMissing) bits.push(`${hiddenAlive} likely-living missing ${hiddenAlive === 1 ? 'person' : 'people'} hidden`);
    html += `<div class="legend">${bits.join(' · ')}</div>`;
  }

  html += `<div class="legend">
    <span><span class="dot" style="background:var(--accent-soft)"></span>In both files</span>
    <span><span class="dot" style="background:var(--miss-soft)"></span>Missing from one file</span>
    <span><span class="dot" style="background:var(--warn-soft)"></span>Possible match / needs verification</span>
  </div>`;

  if (!visibleSections.length) {
    html += `<div class="section"><div style="padding:20px;color:var(--muted);font-size:13px;">Nothing to show with the current filters — try unchecking one above.</div></div>`;
  }

  for (const section of visibleSections) {
    html += `<div class="section">
      <div class="section-head"><span>${esc(section.label)}</span><span class="gen">generation ${section.gen}</span></div>
      <table>
        <thead><tr><th style="width:12%">Role</th><th style="width:20%">Individual</th><th style="width:13%">Status</th><th>Attributes</th></tr></thead>
        <tbody>`;
    for (const row of section.rows) {
      html += `<tr>
        <td class="role-tag">${esc(row.role)}</td>
        <td>${esc(row.name || '(unnamed)')}</td>
        <td>${statusBadge(row.status)}</td>
        <td>`;
      if (row.fieldDiffs) {
        html += `<table style="border:none;">`;
        for (const f of row.fieldDiffs) {
          html += `<tr style="border:none;"><td style="border:none;padding:2px 8px 2px 0;color:var(--muted);white-space:nowrap;">${esc(f.label)}</td><td style="border:none;padding:2px 0;">${renderValueCell(f, ignoreSimilarLocations, locationThreshold)}</td></tr>`;
        }
        html += `</table>`;
      } else {
        const aliveNote = isLikelyAlive(row, aliveYears) ? ' <span class="empty-val">(possibly still living)</span>' : '';
        html += `<span class="empty-val">Not present to compare — add to the missing file.</span>${aliveNote}`;
      }
      html += `</td></tr>`;
    }
    html += `</tbody></table></div>`;
  }

  el.innerHTML = html;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth' });
}
