// Runs every test file in tests/ as a child process and reports overall pass/fail.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname, 'tests');
const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.js')).sort();

let failures = 0;
for (const file of files) {
  console.log(`\n=== ${file} ===`);
  try {
    const output = execFileSync('node', [path.join(testsDir, file)], { encoding: 'utf8' });
    process.stdout.write(output);
  } catch (err) {
    process.stdout.write(err.stdout || '');
    console.log(`\n(${file} exited with a failure)`);
    failures++;
  }
}

console.log(`\n=======================================`);
if (failures === 0) {
  console.log('All test files passed.');
} else {
  console.log(`${failures} of ${files.length} test file(s) had failures.`);
  process.exit(1);
}
