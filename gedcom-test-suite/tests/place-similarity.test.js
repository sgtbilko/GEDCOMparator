// Direct unit tests for the Sørensen-Dice bigram place-similarity helpers,
// previously only exercised indirectly via substantial-difference.test.js's
// higher-level "birth place" checks.
const { loadApp, check, summary } = require('../harness');

const app = loadApp();
const { normalizePlace, bigrams, placeSimilarity } = app;

check(normalizePlace('Springfield, Illinois!'), 'springfield, illinois',
  'lowercases and strips punctuation other than commas/spaces');
check(normalizePlace('  Boston   MA  '), 'boston ma', 'collapses runs of whitespace and trims ends');
check(normalizePlace(''), '', 'blank stays blank');
check(normalizePlace(null), '', 'null is treated as blank, not an error');

check(bigrams('abc'), ['ab', 'bc'], 'bigrams of a 3-char string');
check(bigrams('a'), [], 'a single character has no bigrams');
check(bigrams(''), [], 'an empty string has no bigrams');

check(placeSimilarity('', ''), 1, 'both blank is a perfect (1) similarity');
check(placeSimilarity('Boston', ''), 0, 'one blank, one filled is zero similarity');
check(placeSimilarity('', 'Boston'), 0, 'zero similarity regardless of which side is blank');
check(placeSimilarity('Boston', 'Boston'), 1, 'identical strings are a perfect match');
check(placeSimilarity('BOSTON', 'boston'), 1, 'case differences do not affect similarity');
check(placeSimilarity('Boston', 'Zurich'), 0, 'unrelated place names sharing no bigrams at all score 0');
check(placeSimilarity('Springfield, Illinois', 'Springfield, Illinois, USA') > 0.5, true,
  'a superset place description scores reasonably high similarity');
check(placeSimilarity('Springfield, Sangamon County, Illinois, USA', 'USA') < 0.2, true,
  'a short place buried inside a much longer one still scores LOW on raw bigram similarity — this is exactly the gap placeIsSubsetOrSuperset() exists to cover for the substantial-difference check');

process.exit(summary('place-similarity'));
