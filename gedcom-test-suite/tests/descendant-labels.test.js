// Tests that descendant generation labels are correct through several generations:
// Child -> Grandchild -> Great-grandchild -> Great-great-grandchild -> ...
const { loadApp, check, summary } = require('../harness');

function chain(prefix) {
  return `0 @${prefix}1@ INDI
1 NAME Root /Person/
1 FAMS @${prefix}F1@
0 @${prefix}2@ INDI
1 NAME Kid1 /Person/
1 FAMC @${prefix}F1@
1 FAMS @${prefix}F2@
0 @${prefix}3@ INDI
1 NAME Kid2 /Person/
1 FAMC @${prefix}F2@
1 FAMS @${prefix}F3@
0 @${prefix}4@ INDI
1 NAME Kid3 /Person/
1 FAMC @${prefix}F3@
1 FAMS @${prefix}F4@
0 @${prefix}5@ INDI
1 NAME Kid4 /Person/
1 FAMC @${prefix}F4@
0 @${prefix}F1@ FAM
1 CHIL @${prefix}2@
0 @${prefix}F2@ FAM
1 CHIL @${prefix}3@
0 @${prefix}F3@ FAM
1 CHIL @${prefix}4@
0 @${prefix}F4@ FAM
1 CHIL @${prefix}5@
`;
}

const app = loadApp({ rootA: 'I1', rootB: 'P1', maxGen: '1', descendantGen: '4' });
app.loadGedcomFiles(chain('I'), chain('P'));
app.runCompare();

const rootSection = app.getVar('lastSections').find(s => s.label === 'Root');
const roleByName = {};
for (const r of rootSection.rows) roleByName[r.name] = r.role;

check(roleByName['Root Person'], 'Ancestor', 'Root is the Ancestor row');
check(roleByName['Kid1 Person'], 'Child', 'Generation 1 -> Child');
check(roleByName['Kid2 Person'], 'Grandchild', 'Generation 2 -> Grandchild');
check(roleByName['Kid3 Person'], 'Great-grandchild', 'Generation 3 -> Great-grandchild');
check(roleByName['Kid4 Person'], 'Great-great-grandchild', 'Generation 4 -> Great-great-grandchild');

process.exit(summary('descendant-labels'));
