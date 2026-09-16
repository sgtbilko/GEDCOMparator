// Shared harness: loads app.js (the GEDCOM Tree Comparator's logic, extracted from
// gedcom-compare.html) into a sandboxed context with a stub `document`, so the
// browser-only functions (parseGedcom, datesMatch, runCompare, etc.) can be
// unit-tested directly from Node without a browser.
//
// If you edit gedcom-compare.html, regenerate app.js by running:
//   node extract-app-js.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function stubElement(overrides = {}) {
  return Object.assign({
    style: {},
    value: '',
    checked: false,
    innerHTML: '',
    textContent: '',
    addEventListener: () => {},
    scrollIntoView: () => {}
  }, overrides);
}

// idValues: { elementId: 'the .value or boolean to return' } — a simple way to
// stand in for form fields (dropdowns, checkboxes, number inputs) that runCompare() reads.
function loadApp(idValues = {}) {
  const appPath = path.join(__dirname, 'app.js');
  const js = fs.readFileSync(appPath, 'utf8');

  const sandbox = {
    console,
    document: {
      getElementById(id) {
        if (id in idValues) {
          const v = idValues[id];
          if (typeof v === 'boolean') return stubElement({ checked: v });
          return stubElement({ value: String(v) });
        }
        return stubElement();
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(js, sandbox);

  // IMPORTANT: app.js declares `let dataA = null, dataB = null;` at its top level.
  // Assigning `sandbox.dataA = ...` from out here would NOT update that binding —
  // top-level `let`/`const` in a vm context live in a lexical environment that
  // doesn't alias to context-object properties. Setting them must happen via code
  // run *inside* the context instead, which this helper does for you.
  sandbox.loadGedcomFiles = function loadGedcomFiles(gedA, gedB) {
    vm.runInContext(
      `dataA = parseGedcom(${JSON.stringify(gedA)}); dataB = parseGedcom(${JSON.stringify(gedB)});`,
      sandbox
    );
  };

  // Same story for reading a top-level `let`/`const` (e.g. lastSections) from outside —
  // a plain `sandbox.lastSections` property read won't see it, since it was never a
  // property to begin with. Evaluating the name as an expression inside the context does.
  sandbox.getVar = function getVar(name) {
    return vm.runInContext(name, sandbox);
  };

  return sandbox;
}

let passCount = 0, failCount = 0;

function check(actual, expected, description) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passCount++; else failCount++;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${description}${ok ? '' : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
  return ok;
}

function summary(label) {
  console.log(`\n${label}: ${passCount} passed, ${failCount} failed`);
  const exitCode = failCount > 0 ? 1 : 0;
  passCount = 0; failCount = 0;
  return exitCode;
}

module.exports = { loadApp, check, summary };
