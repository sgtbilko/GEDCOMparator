// Minimal reconstruction of the project's Node vm-based test harness:
// loads GEDCOMparator.html's inline <script> into a sandboxed context with a
// stubbed `document`, exposing top-level functions on the returned app object
// plus loadGedcomFiles()/getVar() helpers for reading/writing top-level let/const state.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function extractScript(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('No <script> block found');
  return m[1];
}

function makeStubDocument() {
  const elements = {};
  function el(id) {
    if (!elements[id]) {
      elements[id] = {
        value: '', checked: false, textContent: '', innerHTML: '',
        style: {}, disabled: false,
        classList: { toggle() {}, add() {}, remove() {} },
        addEventListener() {}, scrollIntoView() {}
      };
    }
    return elements[id];
  }
  return {
    _el: el,
    getElementById: id => el(id),
    createElement: () => ({ style: {} })
  };
}

function loadApp(initial = {}) {
  const scriptSrc = extractScript(fs.readFileSync(path.join(__dirname, 'GEDCOMparator.html'), 'utf8'));
  const document = makeStubDocument();

  // Seed defaults matching the real HTML's checked/value attributes exactly,
  // so tests reflect actual default behavior; overrides layer on top.
  const defaults = {
    maxGen: '6', descendantGen: '0',
    includeAncestorSpouses: true, includeSiblings: false, includeSibSpouses: false,
    hideAllSubDetails: true, groupByAncestor: true, onlyShowMissing: false, hideExactMatches: true, hideReviewedItems: true,
    ignoreLikelyAlive: true, hideNoBirthDate: false, ignoreSimilarLocations: true,
    aliveYears: '80', locationThreshold: '50'
  };
  const merged = Object.assign({}, defaults, initial);
  for (const [id, val] of Object.entries(merged)) {
    const e = document._el(id);
    if (typeof val === 'boolean') e.checked = val; else e.value = val;
  }

  const sandbox = { document, console, URL, Date };
  vm.createContext(sandbox);
  vm.runInContext(scriptSrc, sandbox);

  // Top-level `let`/`const` bindings (dataA, dataB, lastSections, ...) are NOT
  // exposed as own properties of the sandbox object — that's normal vm/lexical
  // scoping, not a bug — but they stay live across separate runInContext calls
  // on the same context. So reading/writing them has to happen by running a
  // further snippet *inside* the context, not by touching the sandbox object.
  const app = { getVar: varName => vm.runInContext(varName, sandbox) };
  for (const key of Object.keys(sandbox)) {
    if (typeof sandbox[key] === 'function') app[key] = sandbox[key];
  }
  app.loadGedcomFiles = (gedA, gedB) => {
    sandbox.__gedA = gedA;
    sandbox.__gedB = gedB;
    vm.runInContext('dataA = parseGedcom(__gedA); dataB = parseGedcom(__gedB);', sandbox);
  };
  app._document = document;
  return app;
}

let passCount = 0, failCount = 0;
function check(actual, expected, desc) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) passCount++; else failCount++;
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${desc}${pass ? '' : ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`}`);
}
function summary(name) {
  console.log(`\n${name}: ${passCount} passed, ${failCount} failed`);
  return failCount > 0 ? 1 : 0;
}

module.exports = { loadApp, check, summary };
