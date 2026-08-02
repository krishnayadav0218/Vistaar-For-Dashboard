// Lightweight test suite for Vistaar's pure logic functions — no dependencies, no build step,
// consistent with the rest of the project. Run with: node tests/logic.test.js
//
// How this works: rather than hand-copying the functions under test (which silently drifts out
// of sync the moment index.html changes), this file extracts the exact function source straight
// out of ../index.html at run time and evaluates it. If a function is renamed or its signature
// changes, this file breaks loudly instead of quietly testing stale logic.
//
// Only pure, DOM-free functions are covered — the parsing/inference/statistics helpers that are
// also embedded verbatim into the Web Worker (see getWorkerSource() in index.html).
//
// Requires the `xlsx` package for the extractRowsSmart test (npm install xlsx --no-save).
// If xlsx isn't installed, that one test is skipped rather than failing the whole run.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const INDEX_HTML = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(INDEX_HTML, 'utf8');

function extractFn(name){
  const re = new RegExp('\\n  function ' + name + '\\(.*?\\n  \\}\\n', 's');
  const m = src.match(re);
  if(!m) throw new Error(`Could not find function "${name}" in index.html — has it been renamed?`);
  return m[0];
}
function extractIdNameRe(){
  const m = src.match(/const ID_NAME_RE = (\/\^.*?);\n/);
  if(!m) throw new Error('Could not find ID_NAME_RE in index.html');
  return `const ID_NAME_RE = ${m[1]};\n`;
}

// Build a sandboxed context containing just the pure functions, in dependency order.
const sandbox = {};
const vm = require('vm');
vm.createContext(sandbox);
vm.runInContext(`
  const HEADER_SCAN_ROWS = 10;
  const SAMPLE_SIZE = 200;
  ${extractIdNameRe()}
  ${extractFn('parseNumericLoose')}
  ${extractFn('dropEmptyColumns')}
  ${extractFn('stripAggregateRows')}
  ${extractFn('inferColumns')}
  function numVal(v){ if(v instanceof Date) return v.getTime(); return parseNumericLoose(v); }
  ${extractFn('pearson')}
  ${extractFn('linearRegression')}
  ${extractFn('forecastSeries')}
  ${extractFn('movingAverage')}
  ${extractFn('correlationMatrix')}
`, sandbox);

let passed = 0, failed = 0;
function test(name, fn){
  try{ fn(); passed++; console.log(`  ok  - ${name}`); }
  catch(err){ failed++; console.error(`  FAIL - ${name}\n        ${err.message}`); }
}

console.log('parseNumericLoose');
test('parses plain numbers', () => assert.strictEqual(sandbox.parseNumericLoose(42), 42));
test('parses currency-formatted strings', () => assert.strictEqual(sandbox.parseNumericLoose('₹1,23,456.50'), 123456.50));
test('parses percent strings', () => assert.strictEqual(sandbox.parseNumericLoose('45.2%'), 45.2));
test('parses parenthesised negatives (accounting format)', () => assert.strictEqual(sandbox.parseNumericLoose('(500)'), -500));
test('treats a lone dash as unparseable, not zero', () => assert.strictEqual(sandbox.parseNumericLoose('-'), null));
test('rejects non-numeric text', () => assert.strictEqual(sandbox.parseNumericLoose('N/A'), null));
test('rejects Date instances', () => assert.strictEqual(sandbox.parseNumericLoose(new Date()), null));

console.log('stripAggregateRows');
test('removes TOTAL rows', () => {
  const rows = [
    {a:'x', b:1}, {a:'y', b:2}, {a:'z', b:3}, {a:'TOTAL', b:6}
  ];
  const out = sandbox.stripAggregateRows(rows);
  assert.strictEqual(out.some(r => r.a === 'TOTAL'), false);
});
test('leaves short row sets untouched (below the 4-row threshold)', () => {
  const rows = [{a:'TOTAL', b:1}, {a:'x', b:2}];
  assert.strictEqual(sandbox.stripAggregateRows(rows).length, 2);
});

console.log('dropEmptyColumns');
test('drops a column that is blank in every row', () => {
  const rows = [{a:1, b:null}, {a:2, b:null}, {a:3, b:''}];
  const out = sandbox.dropEmptyColumns(rows);
  assert.strictEqual('b' in out[0], false);
  assert.strictEqual(out[0].a, 1);
});
test('keeps a column with any real values', () => {
  const rows = [{a:1, b:null}, {a:2, b:5}];
  const out = sandbox.dropEmptyColumns(rows);
  assert.strictEqual('b' in out[0], true);
});

console.log('inferColumns');
test('detects a numeric column', () => {
  const rows = [{amt:'100'}, {amt:'200'}, {amt:'300'}];
  const cols = sandbox.inferColumns(rows);
  assert.strictEqual(cols[0].type, 'numeric');
});
test('detects a date column', () => {
  const rows = [{d:'2026-01-01'}, {d:'2026-02-01'}, {d:'2026-03-01'}];
  const cols = sandbox.inferColumns(rows);
  assert.strictEqual(cols[0].type, 'date');
});
test('flags an S.No-style column as an ID column', () => {
  const rows = [{'S.No':'1', name:'a'}, {'S.No':'2', name:'b'}, {'S.No':'3', name:'c'}];
  const cols = sandbox.inferColumns(rows);
  const snoCol = cols.find(c => c.name === 'S.No');
  assert.strictEqual(snoCol.isId, true);
});
test('does not flag a low-cardinality text column as an ID column', () => {
  const rows = Array.from({length:20}, (_,i) => ({region: i % 3 === 0 ? 'North' : i % 3 === 1 ? 'South' : 'East'}));
  const cols = sandbox.inferColumns(rows);
  assert.strictEqual(cols[0].isId, false);
});

console.log('linearRegression');
test('fits a perfect line exactly', () => {
  const reg = sandbox.linearRegression([3,5,7,9,11]); // y = 2x + 3
  assert(Math.abs(reg.slope - 2) < 1e-9, 'slope wrong: ' + reg.slope);
  assert(Math.abs(reg.intercept - 3) < 1e-9, 'intercept wrong: ' + reg.intercept);
});
test('returns null with fewer than 2 points', () => {
  assert.strictEqual(sandbox.linearRegression([5]), null);
});

console.log('forecastSeries');
test('extrapolates a steady trend correctly, with dates advanced by the observed interval', () => {
  const labels = ['2026-01-01','2026-01-02','2026-01-03','2026-01-04','2026-01-05'];
  const values = [100,110,120,130,140];
  const f = sandbox.forecastSeries(labels, values, 3);
  assert.strictEqual(f.futureLabels.length, 3);
  assert.strictEqual(f.futureLabels[0], '2026-01-06');
  assert.strictEqual(f.futureLabels[2], '2026-01-08');
  assert(Math.abs(f.futureValues[0] - 150) < 1e-6, 'day6 forecast wrong: ' + f.futureValues[0]);
  assert(Math.abs(f.futureValues[2] - 170) < 1e-6, 'day8 forecast wrong: ' + f.futureValues[2]);
});
test('refuses to forecast from fewer than 4 points', () => {
  assert.strictEqual(sandbox.forecastSeries(['2026-01-01','2026-01-02'], [1,2], 3), null);
});

console.log('movingAverage');
test('windows correctly including the ramp-up period', () => {
  const ma = sandbox.movingAverage([1,2,3,4,5], 3);
  assert.strictEqual(ma.length, 5);
  assert(Math.abs(ma[0] - 1) < 1e-9);     // window of 1 at the start
  assert(Math.abs(ma[1] - 1.5) < 1e-9);   // window of 2
  assert(Math.abs(ma[2] - 2) < 1e-9);     // full window of 3: (1+2+3)/3
  assert(Math.abs(ma[4] - 4) < 1e-9);     // (3+4+5)/3
});

console.log('correlationMatrix');
test('computes symmetric pairwise correlations, with 1 on the diagonal', () => {
  const rows = [
    {a:1, b:2, c:5}, {a:2, b:4, c:1}, {a:3, b:6, c:9}, {a:4, b:8, c:2}, {a:5, b:10, c:7},
  ];
  const numCols = [{name:'a'}, {name:'b'}, {name:'c'}];
  const {names, matrix} = sandbox.correlationMatrix(rows, numCols);
  assert.deepStrictEqual(names, ['a','b','c']);
  assert(Math.abs(matrix[0][1] - 1) < 1e-6, 'a vs b should be perfectly correlated: ' + matrix[0][1]);
  assert(Math.abs(matrix[1][0] - 1) < 1e-6, 'matrix should be symmetric');
  assert.strictEqual(matrix[0][0], 1);
});
test('returns null for a pair with fewer than 3 valid paired values', () => {
  const rows = [{a:1, b:2}, {a:null, b:3}];
  const numCols = [{name:'a'}, {name:'b'}];
  const {matrix} = sandbox.correlationMatrix(rows, numCols);
  assert.strictEqual(matrix[0][1], null);
});

// extractRowsSmart needs the real `xlsx` package (Web-Worker/browser code loads it via
// importScripts from a CDN; here we just need it to build a worksheet object to parse).
console.log('extractRowsSmart (requires xlsx package)');
try{
  const XLSX = require('xlsx');
  vm.runInContext(`
    ${extractFn('extractRowsSmart')}
  `, sandbox);
  sandbox.XLSX = XLSX;

  test('finds the real header row past a title row, and strips a trailing TOTAL row', () => {
    const aoa = [
      ['Collection Report - May 2026'],
      ['Branch', 'Target', 'Collection'],
      ['Mumbai', 100000, 92000],
      ['Delhi', 80000, 76000],
      ['Pune', 60000, 40000],
      ['TOTAL', 240000, 208000],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const rows = sandbox.extractRowsSmart(ws);
    assert.strictEqual(rows.length, 3, `expected 3 data rows, got ${rows.length}`);
    assert.strictEqual(rows[0].Branch, 'Mumbai');
    assert.strictEqual(rows.some(r => r.Branch === 'TOTAL'), false);
  });
}catch(err){
  if(err.code === 'MODULE_NOT_FOUND'){
    console.log('  skip - xlsx package not installed (npm install xlsx --no-save to enable)');
  } else {
    failed++;
    console.error(`  FAIL - extractRowsSmart setup\n        ${err.message}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
