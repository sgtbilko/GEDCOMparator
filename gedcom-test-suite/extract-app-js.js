// Regenerates app.js from gedcom-compare.html's embedded <script> block.
// Run this after editing the HTML file so the test suite stays in sync with it.
//
// Usage: node extract-app-js.js [path-to-gedcom-compare.html]

const fs = require('fs');
const path = require('path');

const htmlPath = process.argv[2] || path.join(__dirname, '..', 'gedcom-compare.html');
const outPath = path.join(__dirname, 'app.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const match = html.match(/<script>([\s\S]*)<\/script>/);
if (!match) {
  console.error('Could not find a <script> block in', htmlPath);
  process.exit(1);
}

fs.writeFileSync(outPath, match[1]);
console.log(`Wrote ${outPath} (${match[1].split('\n').length} lines) from ${htmlPath}`);
