#!/usr/bin/env node
/* Evaluate Excel formulas against the Novamart workbook from the shell.
   node tools/xl-cli.js '=SUMIFS(Sales!P:P,Sales!G:G,"App")'   -> one formula
   node tools/xl-cli.js --sheets                                -> sheet + column letters
   node tools/xl-cli.js --head Sales 5                          -> first rows of a sheet
   node tools/xl-cli.js --file formulas.txt                     -> one formula per line
   node tools/xl-cli.js --functions                             -> supported function list */
var path = require('path');
var fs = require('fs');
var site = path.join(__dirname, '..');
require(path.join(site, 'data.js'));
require(path.join(site, 'xl.js'));
var XL = globalThis.XL, ND = globalThis.NovamartData;
var WB = ND.buildWorkbook();
XL.setWorkbook(WB);

function show(v, maxRows) {
  maxRows = maxRows || 40;
  if (XL.isMat(v)) {
    var lines = [];
    var rows = v.rows.slice(0, maxRows);
    rows.forEach(function (r) { lines.push(r.map(function (c) { return XL.display(c); }).join(' | ')); });
    if (v.h > maxRows) lines.push('… ' + (v.h - maxRows) + ' more rows');
    return '[' + v.h + '×' + v.w + ' array]\n' + lines.join('\n');
  }
  if (XL.isErr(v)) return v.code + (v.msg ? '  (' + v.msg + ')' : '');
  return XL.display(v) + (typeof v === 'number' && !Number.isInteger(v) ? '   (raw ' + v + ')' : '');
}
function run(f) {
  try { return show(XL.evaluate(f)); }
  catch (e) { if (XL.isErr(e)) return e.code + (e.msg ? '  (' + e.msg + ')' : ''); throw e; }
}

var a = process.argv.slice(2);
if (!a.length || a[0] === '--help') { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 7).join('\n')); process.exit(0); }
if (a[0] === '--sheets') {
  WB.sheets.forEach(function (s) {
    console.log(s.name + ' (' + s.rows.length + ' rows) — ' + s.desc);
    console.log('  ' + s.cols.map(function (c, i) { return XL.numToCol(i + 1) + ' ' + c.name + ' [' + c.type + ']'; }).join(', '));
  });
} else if (a[0] === '--head') {
  var s = WB.sheets.filter(function (x) { return x.name.toLowerCase() === (a[1] || '').toLowerCase(); })[0];
  if (!s) { console.error('No such sheet'); process.exit(1); }
  var n = +(a[2] || 8);
  console.log(s.cols.map(function (c, i) { return XL.numToCol(i + 1) + ':' + c.name; }).join(' | '));
  s.rows.slice(0, n).forEach(function (r, i) { console.log((i + 2) + ' | ' + r.map(function (v, ci) { return XL.display(v, s.cols[ci].type); }).join(' | ')); });
} else if (a[0] === '--functions') {
  console.log(XL.functions().join(', '));
} else if (a[0] === '--file') {
  fs.readFileSync(a[1], 'utf8').split('\n').forEach(function (line) { var f = line.trim(); if (!f || f[0] === '#') return; console.log(f + '\n  => ' + run(f).replace(/\n/g, '\n     ')); });
} else {
  a.forEach(function (f) { console.log(run(f)); });
}
