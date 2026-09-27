/* Formula Lab engine — a small, faithful Excel formula evaluator.
   Runs the same in the browser (Formula Lab, Run buttons) and in Node (build-time checks).
   Dynamic-array semantics: a range in a scalar position spills, operators broadcast.
   Dates are Excel serial numbers. TODAY() is pinned to the dataset's as-of date (31 Aug 2026)
   so every answer in the course is reproducible. */
(function (root) {
  'use strict';

  /* ---------------- values ---------------- */
  function XErr(code, msg) { this.code = code; this.msg = msg || ''; }
  XErr.prototype.toString = function () { return this.code; };
  var E = {
    NA: function (m) { return new XErr('#N/A', m); },
    VALUE: function (m) { return new XErr('#VALUE!', m); },
    DIV0: function (m) { return new XErr('#DIV/0!', m); },
    REF: function (m) { return new XErr('#REF!', m); },
    NAME: function (m) { return new XErr('#NAME?', m); },
    NUM: function (m) { return new XErr('#NUM!', m); },
    CALC: function (m) { return new XErr('#CALC!', m); }
  };
  function isErr(v) { return v instanceof XErr; }

  /* A matrix is a 2-D array of scalars. Ranges evaluate to matrices with a .ref (sheet, r0, c0). */
  function Mat(rows, ref) { this.rows = rows; this.h = rows.length; this.w = rows.length ? rows[0].length : 0; this.ref = ref || null; }
  function isMat(v) { return v instanceof Mat; }
  function mat1(v) { return new Mat([[v]]); }
  function flat(v) {
    if (!isMat(v)) return [v];
    var out = [];
    for (var r = 0; r < v.h; r++) for (var c = 0; c < v.w; c++) out.push(v.rows[r][c]);
    return out;
  }
  function col(v) { // matrix -> array of column arrays
    var out = [];
    for (var c = 0; c < v.w; c++) { var a = []; for (var r = 0; r < v.h; r++) a.push(v.rows[r][c]); out.push(a); }
    return out;
  }
  function scalar(v) { // a 1x1 matrix collapses; a bigger one is returned as-is
    if (isMat(v)) { if (v.h === 1 && v.w === 1) return v.rows[0][0]; return v; }
    return v;
  }

  /* ---------------- workbook ---------------- */
  var WB = null; // { sheets: [...], byName: {}, asOf }
  function setWorkbook(wb) {
    WB = { sheets: wb.sheets, byName: {}, asOf: wb.asOf };
    wb.sheets.forEach(function (s) { WB.byName[s.name.toLowerCase()] = s; });
  }
  function getSheet(name) {
    if (!WB) throw E.REF('No workbook is loaded.');
    var s = WB.byName[(name || '').toLowerCase()];
    if (!s) throw E.REF("There is no sheet called '" + name + "'. Sheets: " + WB.sheets.map(function (x) { return x.name; }).join(', '));
    return s;
  }
  /* Cell (row r >= 1, col c >= 1) of a sheet; row 1 is the header. Returns null for blank. */
  function cellOf(s, r, c) {
    if (r < 1 || c < 1 || c > s.cols.length) return null;
    if (r === 1) return s.cols[c - 1].name;
    var row = s.rows[r - 2];
    if (!row) return null;
    var v = row[c - 1];
    return v === undefined ? null : v;
  }
  function usedRows(s) { return s.rows.length + 1; }

  function colToNum(letters) { var n = 0; for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64); return n; }
  function numToCol(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

  /* ---------------- tokenizer ---------------- */
  var REF_RE = /^(?:(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_.]*))!)?(?:\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?|\$?([A-Za-z]{1,3}):\$?([A-Za-z]{1,3})|\$?(\d+):\$?(\d+))(?![A-Za-z0-9_(])/;

  function tokenize(src) {
    var toks = [], i = 0, n = src.length;
    while (i < n) {
      var ch = src[i];
      if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') { i++; continue; }
      if (ch === '"') {
        var j = i + 1, s = '';
        while (j < n) {
          if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; }
          s += src[j++];
        }
        if (j >= n) throw E.VALUE('A text value is missing its closing quote.');
        toks.push({ t: 'str', v: s }); i = j + 1; continue;
      }
      var m = REF_RE.exec(src.slice(i));
      if (m) {
        var sheet = m[1] ? m[1].replace(/''/g, "'") : (m[2] || null);
        var tok = { t: 'ref', sheet: sheet };
        if (m[3]) { tok.c0 = colToNum(m[3].toUpperCase()); tok.r0 = +m[4]; tok.c1 = m[5] ? colToNum(m[5].toUpperCase()) : tok.c0; tok.r1 = m[6] ? +m[6] : tok.r0; }
        else if (m[7]) { tok.c0 = colToNum(m[7].toUpperCase()); tok.c1 = colToNum(m[8].toUpperCase()); tok.r0 = 1; tok.r1 = null; }
        else { tok.r0 = +m[9]; tok.r1 = +m[10]; tok.c0 = 1; tok.c1 = null; }
        if (tok.c1 !== null && tok.c1 < tok.c0) { var t = tok.c0; tok.c0 = tok.c1; tok.c1 = t; }
        if (tok.r1 !== null && tok.r1 < tok.r0) { var t2 = tok.r0; tok.r0 = tok.r1; tok.r1 = t2; }
        toks.push(tok); i += m[0].length; continue;
      }
      var num = /^(\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(src.slice(i));
      if (num) { toks.push({ t: 'num', v: parseFloat(num[0]) }); i += num[0].length; continue; }
      var id = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i));
      if (id) {
        var name = id[0];
        var k = i + name.length;
        while (k < n && src[k] === ' ') k++;
        if (src[k] === '(') toks.push({ t: 'fn', v: name.toUpperCase() });
        else if (/^(TRUE|FALSE)$/i.test(name)) toks.push({ t: 'bool', v: /^TRUE$/i.test(name) });
        else toks.push({ t: 'name', v: name });
        i += name.length; continue;
      }
      var two = src.substr(i, 2);
      if (two === '<>' || two === '<=' || two === '>=') { toks.push({ t: 'op', v: two }); i += 2; continue; }
      if ('+-*/^&=<>(),;{}%:'.indexOf(ch) >= 0) { toks.push({ t: 'op', v: ch }); i++; continue; }
      throw E.VALUE("Unexpected character '" + ch + "' in the formula.");
    }
    return toks;
  }

  /* ---------------- parser (precedence climbing) ---------------- */
  function parse(src) {
    var s = String(src).trim();
    if (s.charAt(0) === '=') s = s.slice(1);
    if (!s) throw E.VALUE('Type a formula first.');
    var toks = tokenize(s), p = 0;
    function peek() { return toks[p]; }
    function next() { return toks[p++]; }
    function isOp(v) { var t = peek(); return t && t.t === 'op' && t.v === v; }
    function expect(v) { if (!isOp(v)) throw E.VALUE("Expected '" + v + "'" + (peek() ? " but found '" + (peek().v || peek().t) + "'" : ' but the formula ended') + '.'); next(); }

    function comparison() {
      var left = concat();
      while (peek() && peek().t === 'op' && /^(=|<>|<=|>=|<|>)$/.test(peek().v)) { var op = next().v; left = { k: 'bin', op: op, l: left, r: concat() }; }
      return left;
    }
    function concat() {
      var left = additive();
      while (isOp('&')) { next(); left = { k: 'bin', op: '&', l: left, r: additive() }; }
      return left;
    }
    function additive() {
      var left = multiplicative();
      while (isOp('+') || isOp('-')) { var op = next().v; left = { k: 'bin', op: op, l: left, r: multiplicative() }; }
      return left;
    }
    function multiplicative() {
      var left = power();
      while (isOp('*') || isOp('/')) { var op = next().v; left = { k: 'bin', op: op, l: left, r: power() }; }
      return left;
    }
    function power() {
      var left = unary();
      while (isOp('^')) { next(); left = { k: 'bin', op: '^', l: left, r: unary() }; }
      return left;
    }
    function unary() {
      if (isOp('-')) { next(); return { k: 'neg', a: unary() }; }
      if (isOp('+')) { next(); return unary(); }
      return postfix();
    }
    function postfix() {
      var v = primary();
      while (isOp('%')) { next(); v = { k: 'pct', a: v }; }
      return v;
    }
    function primary() {
      var t = next();
      if (!t) throw E.VALUE('The formula ended too early.');
      if (t.t === 'num') return { k: 'num', v: t.v };
      if (t.t === 'str') return { k: 'str', v: t.v };
      if (t.t === 'bool') return { k: 'bool', v: t.v };
      if (t.t === 'ref') return { k: 'ref', ref: t };
      if (t.t === 'name') return { k: 'name', v: t.v };
      if (t.t === 'fn') {
        expect('(');
        var args = [];
        if (!isOp(')')) {
          for (;;) {
            if (isOp(',')) { args.push({ k: 'empty' }); next(); continue; }
            args.push(comparison());
            if (isOp(',')) { next(); if (isOp(')')) { args.push({ k: 'empty' }); } continue; }
            break;
          }
        }
        expect(')');
        return { k: 'call', fn: t.v, args: args };
      }
      if (t.t === 'op' && t.v === '(') { var e = comparison(); expect(')'); return e; }
      if (t.t === 'op' && t.v === '{') {
        var rows = [[]];
        for (;;) {
          var it = next();
          if (!it) throw E.VALUE('Array constant is missing its closing }.');
          if (it.t === 'num') rows[rows.length - 1].push(it.v);
          else if (it.t === 'str') rows[rows.length - 1].push(it.v);
          else if (it.t === 'bool') rows[rows.length - 1].push(it.v);
          else if (it.t === 'op' && it.v === '-') { var nn = next(); rows[rows.length - 1].push(-nn.v); }
          else throw E.VALUE('Only numbers, text and TRUE/FALSE are allowed inside { }.');
          var sep = next();
          if (sep.t === 'op' && sep.v === ',') continue;
          if (sep.t === 'op' && sep.v === ';') { rows.push([]); continue; }
          if (sep.t === 'op' && sep.v === '}') break;
          throw E.VALUE('Unexpected token inside an array constant.');
        }
        return { k: 'arr', rows: rows };
      }
      throw E.VALUE("Unexpected '" + (t.v !== undefined ? t.v : t.t) + "' in the formula.");
    }
    var ast = comparison();
    if (p < toks.length) throw E.VALUE("Unexpected '" + (peek().v !== undefined ? peek().v : peek().t) + "' after the end of the formula.");
    return ast;
  }

  /* ---------------- coercion ---------------- */
  function toNum(v) {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (isErr(v)) throw v;
    if (typeof v === 'string') {
      var s = v.trim();
      if (s === '') throw E.VALUE('Text cannot be used as a number here.');
      var pct = /%$/.test(s);
      var n = Number(s.replace(/%$/, '').replace(/,/g, ''));
      if (isNaN(n)) { var d = parseDateText(s); if (d !== null) return d; throw E.VALUE('"' + v + '" is text, not a number.'); }
      return pct ? n / 100 : n;
    }
    throw E.VALUE();
  }
  function toStr(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (isErr(v)) throw v;
    if (typeof v === 'number') return numToText(v);
    return String(v);
  }
  function toBool(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (isErr(v)) throw v;
    if (typeof v === 'string') { var u = v.trim().toUpperCase(); if (u === 'TRUE') return true; if (u === 'FALSE') return false; throw E.VALUE('"' + v + '" is not TRUE or FALSE.'); }
    return !!v;
  }
  function numToText(n) {
    if (Number.isInteger(n)) return String(n);
    var s = String(Math.round(n * 1e10) / 1e10);
    return s;
  }
  function isBlank(v) { return v === null || v === undefined || v === ''; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  /* ---------------- dates ---------------- */
  var DAY = 86400000;
  function serialToDate(n) { return new Date(Math.round(n) * DAY + Date.UTC(1899, 11, 30)); }
  function dateToSerial(y, m, d) { return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / DAY); }
  function ymd(n) { var d = serialToDate(n); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: d.getUTCDay() }; }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function parseDateText(s) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (m) return dateToSerial(+m[1], +m[2], +m[3]);
    m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(s); // dd/mm/yyyy (Indian locale)
    if (m) return dateToSerial(+m[3], +m[2], +m[1]);
    m = /^(\d{1,2})[ -]([A-Za-z]{3,9})[ -](\d{4})$/.exec(s);
    if (m) { var mi = monthIndex(m[2]); if (mi >= 0) return dateToSerial(+m[3], mi + 1, +m[1]); }
    return null;
  }
  function monthIndex(name) { var l = name.toLowerCase(); for (var i = 0; i < 12; i++) if (MONTHS[i].toLowerCase().indexOf(l) === 0) return i; return -1; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------------- TEXT() number formats (a useful subset) ---------------- */
  function formatNumber(n, fmt) {
    var f = fmt;
    if (/[ymdh]/i.test(f) && !/[#0]/.test(f.replace(/\[.*?\]/g, ''))) return formatDate(n, f);
    var pct = /%/.test(f);
    if (pct) n = n * 100;
    var currency = '';
    var cm = /\[\$([^\]-]+)(?:-[0-9A-Fa-f]+)?\]/.exec(f);
    if (cm) { currency = cm[1]; f = f.replace(cm[0], ''); }
    var lit = ''; var pm = /^([^#0,.%]+)/.exec(f); if (pm) { lit = pm[1]; f = f.slice(lit.length); }
    var dec = 0; var dm = /\.([0#]+)/.exec(f); if (dm) dec = dm[1].length;
    var grouping = /#,#|0,0|,#|,0/.test(f);
    var indian = /##,##,##0|#,##,##0/.test(f);
    var neg = n < 0; n = Math.abs(n);
    var fixed = n.toFixed(dec);
    var parts = fixed.split('.');
    var intPart = parts[0];
    if (grouping) {
      if (indian) {
        var last3 = intPart.slice(-3), rest = intPart.slice(0, -3);
        if (rest) intPart = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
      } else intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    var out = intPart + (dec ? '.' + parts[1] : '');
    if (pct) out += '%';
    return (neg ? '-' : '') + lit + currency + out;
  }
  function formatDate(n, fmt) {
    var t = ymd(n), out = '', f = fmt, i = 0;
    while (i < f.length) {
      var rest = f.slice(i);
      var m;
      if ((m = /^(yyyy|yy)/i.exec(rest))) { out += m[1].length === 4 ? t.y : pad2(t.y % 100); i += m[1].length; }
      else if ((m = /^(mmmmm|mmmm|mmm|mm|m)/i.exec(rest))) { var L = m[1].length; out += L === 5 ? MONTHS[t.m - 1][0] : L === 4 ? MONTHS[t.m - 1] : L === 3 ? MONTHS[t.m - 1].slice(0, 3) : L === 2 ? pad2(t.m) : t.m; i += L; }
      else if ((m = /^(dddd|ddd|dd|d)/i.exec(rest))) { var L2 = m[1].length; out += L2 === 4 ? DAYS[t.dow] : L2 === 3 ? DAYS[t.dow].slice(0, 3) : L2 === 2 ? pad2(t.d) : t.d; i += L2; }
      else if (rest[0] === '"') { var j = rest.indexOf('"', 1); out += rest.slice(1, j < 0 ? rest.length : j); i += (j < 0 ? rest.length : j + 1); }
      else if (rest[0] === '\\') { out += rest[1] || ''; i += 2; }
      else { out += rest[0]; i++; }
    }
    return out;
  }

  /* ---------------- criteria (SUMIFS, COUNTIF, ...) ---------------- */
  /* Excel wildcards: * any run, ? one char, ~ escapes the next character. */
  function wildcardToRegex(pat) {
    var out = '';
    for (var i = 0; i < pat.length; i++) {
      var ch = pat[i];
      if (ch === '~' && i + 1 < pat.length) { out += pat[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
      else if (ch === '*') out += '.*';
      else if (ch === '?') out += '.';
      else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return out;
  }
  function makeCriterion(crit) {
    crit = scalar(crit);
    if (isErr(crit)) throw crit;
    var op = '=', val = crit;
    if (typeof crit === 'string') {
      var m = /^(<>|<=|>=|=|<|>)(.*)$/.exec(crit);
      if (m) { op = m[1]; val = m[2]; }
      if (typeof val === 'string') {
        var s = val.trim();
        if (s === '') val = null;
        else if (/^-?\d+(\.\d+)?%?$/.test(s) || /^-?\d*\.\d+$/.test(s)) val = toNum(s);
        else if (/^(TRUE|FALSE)$/i.test(s)) val = s.toUpperCase() === 'TRUE';
        else { var d = parseDateText(s); if (d !== null) val = d; else val = s; }
      }
    }
    if (typeof val === 'string' && (op === '=' || op === '<>') && /[*?]/.test(val)) {
      var re = new RegExp('^' + wildcardToRegex(val) + '$', 'i');
      return function (cell) { var ok = typeof cell === 'string' && re.test(cell); return op === '=' ? ok : !ok; };
    }
    if (val === null) { // "" or "=" matches blanks; "<>" matches non-blanks
      if (op === '=') return function (cell) { return isBlank(cell); };
      if (op === '<>') return function (cell) { return !isBlank(cell); };
      return function () { return false; };
    }
    if (typeof val === 'number') {
      return function (cell) {
        if (typeof cell !== 'number') { if (typeof cell === 'string') { var n = Number(cell.replace(/,/g, '')); if (cell.trim() !== '' && !isNaN(n)) cell = n; else return op === '<>'; } else return op === '<>'; }
        switch (op) { case '=': return cell === val; case '<>': return cell !== val; case '<': return cell < val; case '>': return cell > val; case '<=': return cell <= val; case '>=': return cell >= val; }
      };
    }
    if (typeof val === 'boolean') return function (cell) { var ok = cell === val; return op === '<>' ? !ok : ok; };
    var lv = String(val).toLowerCase();
    return function (cell) {
      if (typeof cell !== 'string') return op === '<>';
      var lc = cell.toLowerCase();
      switch (op) { case '=': return lc === lv; case '<>': return lc !== lv; case '<': return lc < lv; case '>': return lc > lv; case '<=': return lc <= lv; case '>=': return lc >= lv; }
    };
  }

  /* ---------------- comparison / equality (Excel rules) ---------------- */
  function typeRank(v) { if (isBlank(v)) return 0; if (typeof v === 'number') return 1; if (typeof v === 'string') return 2; if (typeof v === 'boolean') return 3; return 4; }
  function cmp(a, b) {
    if (isErr(a)) throw a; if (isErr(b)) throw b;
    if (isBlank(a)) a = typeof b === 'string' ? '' : (typeof b === 'boolean' ? false : 0);
    if (isBlank(b)) b = typeof a === 'string' ? '' : (typeof a === 'boolean' ? false : 0);
    var ra = typeRank(a), rb = typeRank(b);
    if (ra !== rb) return ra < rb ? -1 : 1;
    if (typeof a === 'string') { var la = a.toLowerCase(), lb = b.toLowerCase(); return la < lb ? -1 : la > lb ? 1 : 0; }
    if (typeof a === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  /* ---------------- broadcasting ---------------- */
  function broadcast(a, b, fn) {
    var ma = isMat(a), mb = isMat(b);
    if (!ma && !mb) return fn(a, b);
    var h = Math.max(ma ? a.h : 1, mb ? b.h : 1), w = Math.max(ma ? a.w : 1, mb ? b.w : 1);
    var out = [];
    for (var r = 0; r < h; r++) {
      var row = [];
      for (var c = 0; c < w; c++) {
        var x = ma ? pick(a, r, c) : a, y = mb ? pick(b, r, c) : b;
        row.push(guard(function () { return fn(x, y); }));
      }
      out.push(row);
    }
    return new Mat(out);
  }
  function pick(m, r, c) {
    var rr = m.h === 1 ? 0 : r, cc = m.w === 1 ? 0 : c;
    if (rr >= m.h || cc >= m.w) return E.NA();
    return m.rows[rr][cc];
  }
  function map1(a, fn) {
    if (!isMat(a)) return fn(a);
    return new Mat(a.rows.map(function (row) { return row.map(function (v) { return guard(function () { return fn(v); }); }); }));
  }
  function guard(fn) { try { return fn(); } catch (e) { if (isErr(e)) return e; throw e; } }

  /* ---------------- evaluation ---------------- */
  var CALLS = 0;
  function evaluate(src, env) {
    CALLS = 0;
    var ast = parse(src);
    return scalar(ev(ast, env || {}));
  }

  function refToMat(ref) {
    var s = getSheet(ref.sheet || (WB.sheets[0] && WB.sheets[0].name));
    var r0 = ref.r0, r1 = ref.r1 === null ? usedRows(s) : ref.r1;
    var c0 = ref.c0, c1 = ref.c1 === null ? s.cols.length : ref.c1;
    if (r1 > 1048576 || c1 > 16384) throw E.REF();
    if (r1 > usedRows(s)) r1 = Math.max(usedRows(s), r0); // clip to used range; cells beyond are blank anyway
    var rows = [];
    for (var r = r0; r <= r1; r++) { var row = []; for (var c = c0; c <= c1; c++) row.push(cellOf(s, r, c)); rows.push(row); }
    return new Mat(rows, { sheet: s.name, r0: r0, c0: c0 });
  }

  function ev(node, env) {
    if (++CALLS > 2000000) throw E.CALC('This formula is doing too much work; simplify it.');
    switch (node.k) {
      case 'num': return node.v;
      case 'str': return node.v;
      case 'bool': return node.v;
      case 'empty': return null;
      case 'arr': return new Mat(node.rows);
      case 'ref': return refToMat(node.ref);
      case 'name': {
        if (env && Object.prototype.hasOwnProperty.call(env, node.v.toUpperCase())) return env[node.v.toUpperCase()];
        throw E.NAME("'" + node.v + "' is not a function, a cell reference or a name defined with LET.");
      }
      case 'neg': return map1(ev(node.a, env), function (v) { return -toNum(v); });
      case 'pct': return map1(ev(node.a, env), function (v) { return toNum(v) / 100; });
      case 'bin': {
        var l = ev(node.l, env), r = ev(node.r, env), op = node.op;
        switch (op) {
          case '+': return broadcast(l, r, function (a, b) { return toNum(a) + toNum(b); });
          case '-': return broadcast(l, r, function (a, b) { return toNum(a) - toNum(b); });
          case '*': return broadcast(l, r, function (a, b) { return toNum(a) * toNum(b); });
          case '/': return broadcast(l, r, function (a, b) { var d = toNum(b); if (d === 0) throw E.DIV0(); return toNum(a) / d; });
          case '^': return broadcast(l, r, function (a, b) { var p = Math.pow(toNum(a), toNum(b)); if (!isFinite(p)) throw E.NUM(); return p; });
          case '&': return broadcast(l, r, function (a, b) { return toStr(a) + toStr(b); });
          case '=': return broadcast(l, r, function (a, b) { return cmp(a, b) === 0; });
          case '<>': return broadcast(l, r, function (a, b) { return cmp(a, b) !== 0; });
          case '<': return broadcast(l, r, function (a, b) { return cmp(a, b) < 0; });
          case '>': return broadcast(l, r, function (a, b) { return cmp(a, b) > 0; });
          case '<=': return broadcast(l, r, function (a, b) { return cmp(a, b) <= 0; });
          case '>=': return broadcast(l, r, function (a, b) { return cmp(a, b) >= 0; });
        }
        throw E.VALUE();
      }
      case 'call': return call(node, env);
    }
    throw E.VALUE();
  }

  function call(node, env) {
    var name = node.fn;
    if (LAZY[name]) return LAZY[name](node.args, env);
    var fn = FN[name];
    if (!fn) throw E.NAME(name + ' is not a function this Lab knows. See the list under the editor.');
    var args = node.args.map(function (a) { return ev(a, env); });
    return fn.apply(null, args);
  }

  /* ---------------- helpers for function bodies ---------------- */
  function nums(args, opts) { // numbers from a mix of scalars and ranges; Excel rules: text/bool in ranges ignored, errors propagate
    var out = [];
    Array.prototype.forEach.call(args, function (a) {
      if (isMat(a)) flat(a).forEach(function (v) { if (isErr(v)) throw v; if (typeof v === 'number') out.push(v); else if (opts && opts.boolsInRange && typeof v === 'boolean') out.push(v ? 1 : 0); });
      else if (a !== null && a !== undefined) { if (isErr(a)) throw a; out.push(toNum(a)); }
    });
    return out;
  }
  function need(args, n, name) { if (args.length < n) throw E.VALUE(name + ' needs at least ' + n + ' argument' + (n > 1 ? 's' : '') + '.'); }
  function asMat(v) { return isMat(v) ? v : mat1(v); }
  function sumOf(a) { return a.reduce(function (s, x) { return s + x; }, 0); }
  function ifsCore(args, name, hasSumRange) {
    var i = hasSumRange ? 1 : 0;
    var target = hasSumRange ? asMat(args[0]) : null;
    if ((args.length - i) % 2 !== 0 || args.length - i < 2) throw E.VALUE(name + ' takes pairs of range, criteria' + (hasSumRange ? ' after the first range' : '') + '.');
    var pairs = [];
    for (; i < args.length; i += 2) {
      var rng = asMat(args[i]);
      if (target && (rng.h !== target.h || rng.w !== target.w)) throw E.VALUE('In ' + name + ' every criteria range must be the same size as the first range (' + target.h + ' rows vs ' + rng.h + ').');
      pairs.push({ rng: rng, test: makeCriterion(args[i + 1]) });
    }
    var base = target || pairs[0].rng;
    var hits = [];
    for (var r = 0; r < base.h; r++) for (var c = 0; c < base.w; c++) {
      var ok = true;
      for (var k = 0; k < pairs.length; k++) { var cell = pairs[k].rng.rows[r] ? pairs[k].rng.rows[r][c] : null; if (!pairs[k].test(cell)) { ok = false; break; } }
      if (ok) hits.push(target ? target.rows[r][c] : true);
    }
    return hits;
  }
  function lookupMatch(key, arr, mode, wildcard) { // returns index or -1
    key = scalar(key); if (isErr(key)) throw key;
    var n = arr.length;
    if (mode === 0) {
      if (typeof key === 'string' && wildcard && /[*?]/.test(key)) { var test = makeCriterion(key); for (var i = 0; i < n; i++) if (test(arr[i])) return i; return -1; }
      for (var j = 0; j < n; j++) { var v = arr[j]; if (isBlank(v) || isErr(v)) continue; if (typeRank(v) === typeRank(key) && cmp(v, key) === 0) return j; }
      return -1;
    }
    // approximate: 1 = largest <= key (ascending), -1 = smallest >= key (descending)
    var best = -1;
    for (var k = 0; k < n; k++) {
      var w = arr[k]; if (isBlank(w) || isErr(w) || typeRank(w) !== typeRank(key)) continue;
      var c = cmp(w, key);
      if (mode === 1) { if (c <= 0) best = k; else break; }
      else { if (c >= 0) best = k; else break; }
    }
    return best;
  }
  function nearest(key, arr, dir) { // XLOOKUP -1 (next smaller) / 1 (next larger) on unsorted data
    var bestI = -1, bestV = null;
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i]; if (isBlank(v) || isErr(v) || typeRank(v) !== typeRank(key)) continue;
      var c = cmp(v, key);
      if (c === 0) return i;
      if (dir === -1 && c < 0 && (bestV === null || cmp(v, bestV) > 0)) { bestI = i; bestV = v; }
      if (dir === 1 && c > 0 && (bestV === null || cmp(v, bestV) < 0)) { bestI = i; bestV = v; }
    }
    return bestI;
  }
  function rowOf(m, r) { return new Mat([m.rows[r].slice()]); }
  function colOf(m, c) { return new Mat(m.rows.map(function (row) { return [row[c]]; })); }
  function vec(m) { // 1-D vector from a single row or column
    if (m.h === 1) return m.rows[0].slice();
    if (m.w === 1) return m.rows.map(function (r) { return r[0]; });
    throw E.VALUE('This argument must be a single row or a single column.');
  }
  function vecOrScalar(v) { return isMat(v) ? vec(v) : [v]; }
  function sortRows(rows, idx, desc, byCol) {
    var order = rows.map(function (r, i) { return i; });
    order.sort(function (a, b) {
      for (var k = 0; k < idx.length; k++) {
        var va = rows[a][idx[k]], vb = rows[b][idx[k]];
        var c = 0;
        try { c = cmp(va, vb); } catch (e) { c = 0; }
        if (isBlank(va) && !isBlank(vb)) c = 1; else if (!isBlank(va) && isBlank(vb)) c = -1;
        if (c !== 0) return desc[k] ? -c : c;
      }
      return a - b;
    });
    return order.map(function (i) { return rows[i]; });
  }

  /* ---------------- lazy functions ---------------- */
  var LAZY = {
    IF: function (args, env) {
      need(args, 2, 'IF');
      var cond = ev(args[0], env);
      if (isMat(cond)) {
        var t = args[1] ? ev(args[1], env) : true, f = args[2] && args[2].k !== 'empty' ? ev(args[2], env) : false;
        return broadcast(cond, broadcast(t, f, function (a, b) { return [a, b]; }), function (c, tf) { return toBool(c) ? (Array.isArray(tf) ? tf[0] : tf) : (Array.isArray(tf) ? tf[1] : tf); });
      }
      if (isErr(cond)) return cond;
      if (toBool(cond)) return args[1].k === 'empty' ? 0 : ev(args[1], env);
      return args[2] && args[2].k !== 'empty' ? ev(args[2], env) : false;
    },
    IFS: function (args, env) {
      if (args.length < 2 || args.length % 2) throw E.VALUE('IFS takes pairs of test, value.');
      for (var i = 0; i < args.length; i += 2) { var c = scalar(ev(args[i], env)); if (isErr(c)) return c; if (toBool(c)) return ev(args[i + 1], env); }
      return E.NA('No IFS condition was TRUE.');
    },
    IFERROR: function (args, env) {
      need(args, 2, 'IFERROR');
      var v;
      try { v = ev(args[0], env); } catch (e) { if (isErr(e)) return ev(args[1], env); throw e; }
      if (isMat(v)) { var alt = ev(args[1], env); return broadcast(v, alt, function (a, b) { return isErr(a) ? b : a; }); }
      return isErr(v) ? ev(args[1], env) : v;
    },
    IFNA: function (args, env) {
      need(args, 2, 'IFNA');
      var v;
      try { v = ev(args[0], env); } catch (e) { if (isErr(e) && e.code === '#N/A') return ev(args[1], env); throw e; }
      if (isMat(v)) { var alt = ev(args[1], env); return broadcast(v, alt, function (a, b) { return isErr(a) && a.code === '#N/A' ? b : a; }); }
      return isErr(v) && v.code === '#N/A' ? ev(args[1], env) : v;
    },
    AND: function (args, env) { for (var i = 0; i < args.length; i++) { var vals = flat(ev(args[i], env)); for (var j = 0; j < vals.length; j++) { var v = vals[j]; if (isErr(v)) throw v; if (isBlank(v) || typeof v === 'string') continue; if (!toBool(v)) return false; } } return true; },
    OR: function (args, env) { for (var i = 0; i < args.length; i++) { var vals = flat(ev(args[i], env)); for (var j = 0; j < vals.length; j++) { var v = vals[j]; if (isErr(v)) throw v; if (isBlank(v) || typeof v === 'string') continue; if (toBool(v)) return true; } } return false; },
    SWITCH: function (args, env) {
      need(args, 3, 'SWITCH');
      var x = scalar(ev(args[0], env));
      var i = 1;
      for (; i + 1 < args.length; i += 2) { var c = scalar(ev(args[i], env)); if (typeRank(c) === typeRank(x) && cmp(c, x) === 0) return ev(args[i + 1], env); }
      if (i < args.length) return ev(args[i], env);
      return E.NA('SWITCH found no match and has no default.');
    },
    CHOOSE: function (args, env) { need(args, 2, 'CHOOSE'); var i = Math.floor(toNum(scalar(ev(args[0], env)))); if (i < 1 || i >= args.length) throw E.VALUE('CHOOSE index out of range.'); return ev(args[i], env); },
    LET: function (args, env) {
      if (args.length < 3 || args.length % 2 === 0) throw E.VALUE('LET takes name, value pairs followed by one final calculation.');
      var scope = Object.create(env || {});
      for (var i = 0; i + 1 < args.length - 1; i += 2) {
        if (args[i].k !== 'name') throw E.VALUE('LET names must be plain words such as revenue or n.');
        scope[args[i].v.toUpperCase()] = ev(args[i + 1], scope);
      }
      return ev(args[args.length - 1], scope);
    },
    ISERROR: function (args, env) { try { var v = ev(args[0], env); return isMat(v) ? map1(v, function (x) { return isErr(x); }) : isErr(v); } catch (e) { if (isErr(e)) return true; throw e; } },
    ISNA: function (args, env) { try { var v = ev(args[0], env); return isMat(v) ? map1(v, function (x) { return isErr(x) && x.code === '#N/A'; }) : (isErr(v) && v.code === '#N/A'); } catch (e) { if (isErr(e)) return e.code === '#N/A'; throw e; } },
    ROW: function (args, env) { if (!args.length) return 1; var m = ev(args[0], env); if (!isMat(m) || !m.ref) throw E.VALUE('ROW needs a cell reference.'); if (m.h === 1) return m.ref.r0; return new Mat(m.rows.map(function (_, i) { return [m.ref.r0 + i]; })); },
    COLUMN: function (args, env) { if (!args.length) return 1; var m = ev(args[0], env); if (!isMat(m) || !m.ref) throw E.VALUE('COLUMN needs a cell reference.'); if (m.w === 1) return m.ref.c0; return new Mat([m.rows[0].map(function (_, i) { return m.ref.c0 + i; })]); }
  };

  /* ---------------- eager functions ---------------- */
  var FN = {};
  // maths & statistics
  FN.SUM = function () { return sumOf(nums(arguments)); };
  FN.AVERAGE = function () { var a = nums(arguments); if (!a.length) throw E.DIV0('AVERAGE found no numbers.'); return sumOf(a) / a.length; };
  FN.COUNT = function () { var n = 0; Array.prototype.forEach.call(arguments, function (a) { flat(a).forEach(function (v) { if (typeof v === 'number' || (!isMat(a) && typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)))) n++; }); }); return n; };
  FN.COUNTA = function () { var n = 0; Array.prototype.forEach.call(arguments, function (a) { flat(a).forEach(function (v) { if (!isBlank(v)) n++; }); }); return n; };
  FN.COUNTBLANK = function (a) { var n = 0; flat(a).forEach(function (v) { if (isBlank(v)) n++; }); return n; };
  FN.MIN = function () { var a = nums(arguments); return a.length ? Math.min.apply(null, a) : 0; };
  FN.MAX = function () { var a = nums(arguments); return a.length ? Math.max.apply(null, a) : 0; };
  FN.PRODUCT = function () { return nums(arguments).reduce(function (p, x) { return p * x; }, 1); };
  FN.MEDIAN = function () { var a = nums(arguments).sort(function (x, y) { return x - y; }); if (!a.length) throw E.NUM(); var m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  FN.MODE = function () { var a = nums(arguments), cnt = {}, best = null, bc = 0; a.forEach(function (x) { cnt[x] = (cnt[x] || 0) + 1; if (cnt[x] > bc) { bc = cnt[x]; best = x; } }); if (bc < 2) throw E.NA(); return best; };
  FN['STDEV.S'] = FN.STDEV = function () { var a = nums(arguments); if (a.length < 2) throw E.DIV0(); var m = sumOf(a) / a.length; return Math.sqrt(sumOf(a.map(function (x) { return (x - m) * (x - m); })) / (a.length - 1)); };
  FN['STDEV.P'] = function () { var a = nums(arguments); if (!a.length) throw E.DIV0(); var m = sumOf(a) / a.length; return Math.sqrt(sumOf(a.map(function (x) { return (x - m) * (x - m); })) / a.length); };
  FN['VAR.S'] = function () { var a = nums(arguments); if (a.length < 2) throw E.DIV0(); var m = sumOf(a) / a.length; return sumOf(a.map(function (x) { return (x - m) * (x - m); })) / (a.length - 1); };
  FN.LARGE = function (a, k) { var v = nums([a]).sort(function (x, y) { return y - x; }); k = toNum(scalar(k)); if (k < 1 || k > v.length) throw E.NUM(); return v[k - 1]; };
  FN.SMALL = function (a, k) { var v = nums([a]).sort(function (x, y) { return x - y; }); k = toNum(scalar(k)); if (k < 1 || k > v.length) throw E.NUM(); return v[k - 1]; };
  FN['RANK.EQ'] = FN.RANK = function (x, ref, order) { x = toNum(scalar(x)); var v = nums([ref]); var asc = order && toNum(scalar(order)) !== 0; var r = 1; v.forEach(function (y) { if (asc ? y < x : y > x) r++; }); if (v.indexOf(x) < 0) throw E.NA(); return r; };
  FN['PERCENTILE.INC'] = FN.PERCENTILE = function (a, k) { var v = nums([a]).sort(function (x, y) { return x - y; }); k = toNum(scalar(k)); if (!v.length || k < 0 || k > 1) throw E.NUM(); var pos = (v.length - 1) * k, lo = Math.floor(pos), hi = Math.ceil(pos); return v[lo] + (v[hi] - v[lo]) * (pos - lo); };
  FN['QUARTILE.INC'] = FN.QUARTILE = function (a, q) { return FN['PERCENTILE.INC'](a, toNum(scalar(q)) / 4); };
  FN.ROUND = function (x, d) { return broadcast(x, d === undefined ? 0 : d, function (a, b) { var n = toNum(a), f = Math.pow(10, toNum(b)); var s = n < 0 ? -1 : 1; return s * Math.round(Math.abs(n) * f + 1e-9) / f; }); };
  FN.ROUNDUP = function (x, d) { return broadcast(x, d === undefined ? 0 : d, function (a, b) { var n = toNum(a), f = Math.pow(10, toNum(b)); var s = n < 0 ? -1 : 1; return s * Math.ceil(Math.abs(n) * f - 1e-9) / f; }); };
  FN.ROUNDDOWN = FN.TRUNC = function (x, d) { return broadcast(x, d === undefined ? 0 : d, function (a, b) { var n = toNum(a), f = Math.pow(10, toNum(b)); var s = n < 0 ? -1 : 1; return s * Math.floor(Math.abs(n) * f + 1e-9) / f; }); };
  FN.INT = function (x) { return map1(x, function (v) { return Math.floor(toNum(v)); }); };
  FN.ABS = function (x) { return map1(x, function (v) { return Math.abs(toNum(v)); }); };
  FN.SQRT = function (x) { return map1(x, function (v) { var n = toNum(v); if (n < 0) throw E.NUM(); return Math.sqrt(n); }); };
  FN.POWER = function (x, p) { return broadcast(x, p, function (a, b) { return Math.pow(toNum(a), toNum(b)); }); };
  FN.EXP = function (x) { return map1(x, function (v) { return Math.exp(toNum(v)); }); };
  FN.LN = function (x) { return map1(x, function (v) { var n = toNum(v); if (n <= 0) throw E.NUM(); return Math.log(n); }); };
  FN.LOG10 = function (x) { return map1(x, function (v) { var n = toNum(v); if (n <= 0) throw E.NUM(); return Math.log10(n); }); };
  FN.LOG = function (x, b) { var base = b === undefined ? 10 : toNum(scalar(b)); return map1(x, function (v) { return Math.log(toNum(v)) / Math.log(base); }); };
  FN.MOD = function (x, d) { return broadcast(x, d, function (a, b) { var n = toNum(a), m = toNum(b); if (m === 0) throw E.DIV0(); return n - m * Math.floor(n / m); }); };
  FN.SIGN = function (x) { return map1(x, function (v) { var n = toNum(v); return n > 0 ? 1 : n < 0 ? -1 : 0; }); };
  FN.PI = function () { return Math.PI; };
  FN.CEILING = FN['CEILING.MATH'] = function (x, s) { x = toNum(scalar(x)); s = s === undefined ? 1 : toNum(scalar(s)); if (!s) return 0; return Math.ceil(x / s - 1e-9) * s; };
  FN.FLOOR = FN['FLOOR.MATH'] = function (x, s) { x = toNum(scalar(x)); s = s === undefined ? 1 : toNum(scalar(s)); if (!s) return 0; return Math.floor(x / s + 1e-9) * s; };
  FN.MROUND = function (x, m) { x = toNum(scalar(x)); m = toNum(scalar(m)); if (!m) return 0; return Math.round(x / m) * m; };
  FN.EVEN = function (x) { x = toNum(scalar(x)); var c = Math.ceil(Math.abs(x)); if (c % 2) c++; return x < 0 ? -c : c; };
  FN.ODD = function (x) { x = toNum(scalar(x)); var c = Math.ceil(Math.abs(x)); if (c % 2 === 0) c++; return x < 0 ? -c : c; };
  FN.SUMPRODUCT = function () {
    var ms = Array.prototype.map.call(arguments, asMat);
    var h = ms[0].h, w = ms[0].w, total = 0;
    ms.forEach(function (m) { if (m.h !== h || m.w !== w) throw E.VALUE('SUMPRODUCT arrays must all be the same size.'); });
    for (var r = 0; r < h; r++) for (var c = 0; c < w; c++) { var p = 1; for (var k = 0; k < ms.length; k++) { var v = ms[k].rows[r][c]; if (isErr(v)) throw v; p *= (typeof v === 'number') ? v : (typeof v === 'boolean' ? (v ? 1 : 0) : 0); } total += p; }
    return total;
  };
  FN.SUMSQ = function () { return sumOf(nums(arguments).map(function (x) { return x * x; })); };
  FN.SUBTOTAL = function (code) {
    var c = toNum(scalar(code)) % 100, rest = Array.prototype.slice.call(arguments, 1);
    var map = { 1: 'AVERAGE', 2: 'COUNT', 3: 'COUNTA', 4: 'MAX', 5: 'MIN', 6: 'PRODUCT', 7: 'STDEV', 9: 'SUM' };
    if (!map[c]) throw E.VALUE('SUBTOTAL function number ' + c + ' is not supported here.');
    return FN[map[c]].apply(null, rest);
  };
  FN.AGGREGATE = function (code, opts) { var rest = Array.prototype.slice.call(arguments, 2); return FN.SUBTOTAL.apply(null, [code].concat(rest)); };
  // conditional
  // Excel 365 semantics: an array criterion (e.g. SUMIFS(Sales!P:P,Sales!K:K,UNIQUE(Sales!K2:K6315))) spills one result per criterion cell.
  function isArrayCrit(c) { return isMat(c) && !(c.h === 1 && c.w === 1); }
  function withArrayCrit(args, hasSumRange, fn) {
    var i0 = (hasSumRange ? 1 : 0) + 1, shape = null;
    for (var i = i0; i < args.length; i += 2) { var c = args[i]; if (isArrayCrit(c)) { if (shape && (shape.h !== c.h || shape.w !== c.w)) throw E.VALUE('Array criteria must all have the same shape.'); shape = c; } }
    if (!shape) return fn(args);
    var out = [];
    for (var r = 0; r < shape.h; r++) { var row = []; for (var cc = 0; cc < shape.w; cc++) { var a = args.slice(); for (var k = i0; k < a.length; k += 2) if (isArrayCrit(a[k])) a[k] = a[k].rows[r][cc]; row.push(guard(function () { return fn(a); })); } out.push(row); }
    return new Mat(out);
  }
  FN.SUMIF = function (rng, crit, sumRng) { var t = sumRng === undefined ? rng : sumRng; return withArrayCrit([t, rng, crit], true, function (args) { return sumOf(nums([new Mat(ifsCore(args, 'SUMIF', true).map(function (v) { return [v]; }))])); }); };
  FN.SUMIFS = function () { return withArrayCrit(Array.prototype.slice.call(arguments), true, function (args) { return sumOf(nums([new Mat(ifsCore(args, 'SUMIFS', true).map(function (v) { return [v]; }))])); }); };
  FN.COUNTIF = function (rng, crit) { return withArrayCrit([rng, crit], false, function (args) { return ifsCore(args, 'COUNTIF', false).length; }); };
  FN.COUNTIFS = function () { return withArrayCrit(Array.prototype.slice.call(arguments), false, function (args) { return ifsCore(args, 'COUNTIFS', false).length; }); };
  FN.AVERAGEIF = function (rng, crit, avgRng) { var t = avgRng === undefined ? rng : avgRng; return withArrayCrit([t, rng, crit], true, function (args) { var a = nums([new Mat(ifsCore(args, 'AVERAGEIF', true).map(function (v) { return [v]; }))]); if (!a.length) throw E.DIV0('No cells matched.'); return sumOf(a) / a.length; }); };
  FN.AVERAGEIFS = function () { return withArrayCrit(Array.prototype.slice.call(arguments), true, function (args) { var a = nums([new Mat(ifsCore(args, 'AVERAGEIFS', true).map(function (v) { return [v]; }))]); if (!a.length) throw E.DIV0('No cells matched.'); return sumOf(a) / a.length; }); };
  FN.MAXIFS = function () { return withArrayCrit(Array.prototype.slice.call(arguments), true, function (args) { var a = nums([new Mat(ifsCore(args, 'MAXIFS', true).map(function (v) { return [v]; }))]); return a.length ? Math.max.apply(null, a) : 0; }); };
  FN.MINIFS = function () { return withArrayCrit(Array.prototype.slice.call(arguments), true, function (args) { var a = nums([new Mat(ifsCore(args, 'MINIFS', true).map(function (v) { return [v]; }))]); return a.length ? Math.min.apply(null, a) : 0; }); };
  // logical / info
  FN.NOT = function (x) { return map1(x, function (v) { return !toBool(v); }); };
  FN.XOR = function () { var n = 0; Array.prototype.forEach.call(arguments, function (a) { flat(a).forEach(function (v) { if (toBool(v)) n++; }); }); return n % 2 === 1; };
  FN.TRUE = function () { return true; };
  FN.FALSE = function () { return false; };
  FN.ISBLANK = function (x) { return map1(x, function (v) { return isBlank(v); }); };
  FN.ISNUMBER = function (x) { return map1(x, function (v) { return typeof v === 'number'; }); };
  FN.ISTEXT = function (x) { return map1(x, function (v) { return typeof v === 'string'; }); };
  FN.ISNONTEXT = function (x) { return map1(x, function (v) { return typeof v !== 'string'; }); };
  FN.ISLOGICAL = function (x) { return map1(x, function (v) { return typeof v === 'boolean'; }); };
  FN.ISEVEN = function (x) { return map1(x, function (v) { return Math.floor(toNum(v)) % 2 === 0; }); };
  FN.ISODD = function (x) { return map1(x, function (v) { return Math.floor(toNum(v)) % 2 !== 0; }); };
  FN.N = function (x) { x = scalar(x); if (typeof x === 'number') return x; if (typeof x === 'boolean') return x ? 1 : 0; return 0; };
  FN.NA = function () { return E.NA(); };
  FN.TYPE = function (x) { x = scalar(x); if (isMat(x)) return 64; if (typeof x === 'number' || isBlank(x)) return 1; if (typeof x === 'string') return 2; if (typeof x === 'boolean') return 4; return 16; };
  // lookup & reference
  FN.VLOOKUP = function (key, table, colIdx, approx) {
    table = asMat(table); var ci = Math.floor(toNum(scalar(colIdx))); if (ci < 1 || ci > table.w) throw E.REF('VLOOKUP column index ' + ci + ' is outside the table (' + table.w + ' columns).');
    var ap = approx === undefined ? true : toBool(scalar(approx));
    var keys = colOf(table, 0).rows.map(function (r) { return r[0]; });
    var doOne = function (k) { var i = lookupMatch(k, keys, ap ? 1 : 0, true); if (i < 0) throw E.NA('"' + toStr(k) + '" was not found in the first column.'); return table.rows[i][ci - 1]; };
    return map1(key, doOne);
  };
  FN.HLOOKUP = function (key, table, rowIdx, approx) {
    table = asMat(table); var ri = Math.floor(toNum(scalar(rowIdx))); if (ri < 1 || ri > table.h) throw E.REF();
    var ap = approx === undefined ? true : toBool(scalar(approx));
    var keys = table.rows[0];
    return map1(key, function (k) { var i = lookupMatch(k, keys, ap ? 1 : 0, true); if (i < 0) throw E.NA(); return table.rows[ri - 1][i]; });
  };
  FN.XLOOKUP = function (key, lookup, ret, ifNotFound, matchMode, searchMode) {
    lookup = asMat(lookup); ret = asMat(ret);
    var keys = vec(lookup);
    var mm = matchMode === undefined || matchMode === null ? 0 : toNum(scalar(matchMode));
    var sm = searchMode === undefined || searchMode === null ? 1 : toNum(scalar(searchMode));
    if (lookup.h === 1 ? ret.w !== lookup.w : ret.h !== lookup.h) throw E.VALUE('XLOOKUP: lookup_array and return_array must be the same length (' + keys.length + ' vs ' + (lookup.h === 1 ? ret.w : ret.h) + ').');
    var doOne = function (k) {
      k = scalar(k); if (isErr(k)) throw k;
      var i;
      if (mm === 0) { i = lookupMatch(k, sm < 0 ? keys.slice().reverse() : keys, 0, false); if (sm < 0 && i >= 0) i = keys.length - 1 - i; }
      else if (mm === 2) i = lookupMatch(k, keys, 0, true);
      else i = nearest(k, keys, mm);
      if (i < 0) { if (ifNotFound !== undefined && ifNotFound !== null) return ifNotFound; throw E.NA('"' + toStr(k) + '" was not found.'); }
      return lookup.h === 1 ? colOf(ret, i) : rowOf(ret, i);
    };
    if (isMat(key) && !(key.h === 1 && key.w === 1)) {
      return new Mat(key.rows.map(function (row) { return row.map(function (k) { return guard(function () { return scalar(doOne(k)); }); }); }));
    }
    return scalar(doOne(scalar(key)));
  };
  FN.XMATCH = function (key, lookup, matchMode, searchMode) {
    var keys = vec(asMat(lookup)); var mm = matchMode === undefined ? 0 : toNum(scalar(matchMode));
    return map1(key, function (k) { var i = mm === 0 ? lookupMatch(k, keys, 0, false) : mm === 2 ? lookupMatch(k, keys, 0, true) : nearest(k, keys, mm); if (i < 0) throw E.NA(); return i + 1; });
  };
  FN.MATCH = function (key, lookup, type) {
    var keys = vec(asMat(lookup)); var t = type === undefined ? 1 : toNum(scalar(type));
    return map1(key, function (k) { var i = lookupMatch(k, keys, t, true); if (i < 0) throw E.NA('"' + toStr(k) + '" was not found.'); return i + 1; });
  };
  FN.INDEX = function (arr, r, c) {
    arr = asMat(arr);
    var rn = r === undefined || r === null ? 0 : Math.floor(toNum(scalar(r)));
    var cn = c === undefined || c === null ? (arr.h === 1 && r !== undefined && arr.w > 1 ? rn : 0) : Math.floor(toNum(scalar(c)));
    if (arr.h === 1 && arr.w > 1 && c === undefined) { rn = 0; }
    if (arr.w === 1 && arr.h > 1 && c === undefined) { cn = 0; }
    if (rn < 0 || rn > arr.h || cn < 0 || cn > arr.w) throw E.REF('INDEX position is outside the range.');
    if (rn === 0 && cn === 0) return arr;
    if (rn === 0) return colOf(arr, cn - 1);
    if (cn === 0) return rowOf(arr, rn - 1);
    return arr.rows[rn - 1][cn - 1];
  };
  FN.ROWS = function (a) { return asMat(a).h; };
  FN.COLUMNS = function (a) { return asMat(a).w; };
  FN.TRANSPOSE = function (a) { a = asMat(a); var out = []; for (var c = 0; c < a.w; c++) { var row = []; for (var r = 0; r < a.h; r++) row.push(a.rows[r][c]); out.push(row); } return new Mat(out); };
  FN.FILTER = function (arr, inc, ifEmpty) {
    arr = asMat(arr); inc = asMat(inc);
    var byRow = inc.w === 1 && inc.h === arr.h, byCol = inc.h === 1 && inc.w === arr.w;
    if (!byRow && !byCol) throw E.VALUE('FILTER: the include array must match the rows (' + arr.h + ') or columns (' + arr.w + ') of the array.');
    var out = [];
    if (byRow) { for (var r = 0; r < arr.h; r++) { var v = inc.rows[r][0]; if (isErr(v)) throw v; if (toBool(v)) out.push(arr.rows[r].slice()); } }
    else { for (var r2 = 0; r2 < arr.h; r2++) { var row = []; for (var c = 0; c < arr.w; c++) if (toBool(inc.rows[0][c])) row.push(arr.rows[r2][c]); out.push(row); } if (!out[0] || !out[0].length) out = []; }
    if (!out.length) { if (ifEmpty !== undefined) return ifEmpty; throw E.CALC('FILTER returned nothing. Add an if_empty argument such as "None".'); }
    return new Mat(out);
  };
  FN.UNIQUE = function (arr, byCol, exactlyOnce) {
    arr = asMat(arr); if (byCol && toBool(scalar(byCol))) arr = FN.TRANSPOSE(arr);
    var once = exactlyOnce && toBool(scalar(exactlyOnce));
    var seen = {}, order = [], counts = {};
    arr.rows.forEach(function (row) { var k = JSON.stringify(row.map(function (v) { return typeof v === 'string' ? v.toLowerCase() : v; })); if (!seen[k]) { seen[k] = row; order.push(k); } counts[k] = (counts[k] || 0) + 1; });
    var out = order.filter(function (k) { return !once || counts[k] === 1; }).map(function (k) { return seen[k].slice(); });
    if (!out.length) throw E.CALC();
    var m = new Mat(out); return byCol && toBool(scalar(byCol)) ? FN.TRANSPOSE(m) : m;
  };
  FN.SORT = function (arr, idx, order, byCol) {
    arr = asMat(arr); var i = idx === undefined || idx === null ? 1 : Math.floor(toNum(scalar(idx))); var desc = order !== undefined && order !== null && toNum(scalar(order)) === -1;
    if (byCol && toBool(scalar(byCol))) return FN.TRANSPOSE(FN.SORT(FN.TRANSPOSE(arr), idx, order));
    if (i < 1 || i > arr.w) throw E.VALUE('SORT index is outside the array.');
    return new Mat(sortRows(arr.rows, [i - 1], [desc]));
  };
  FN.SORTBY = function (arr) {
    arr = asMat(arr); var rows = arr.rows.map(function (r) { return r.slice(); });
    var keys = [], descs = [];
    for (var i = 1; i < arguments.length; i += 2) {
      var by = asMat(arguments[i]); if (by.h !== arr.h) throw E.VALUE('SORTBY: by_array must have the same number of rows as the array.');
      var kc = rows[0] ? rows[0].length : 0;
      rows.forEach(function (r, ri) { r.push(by.rows[ri][0]); });
      keys.push(kc); descs.push(arguments[i + 1] !== undefined && toNum(scalar(arguments[i + 1])) === -1);
    }
    var sorted = sortRows(rows, keys, descs);
    return new Mat(sorted.map(function (r) { return r.slice(0, arr.w); }));
  };
  FN.SEQUENCE = function (rows, cols, start, step) {
    var h = Math.floor(toNum(scalar(rows))), w = cols === undefined ? 1 : Math.floor(toNum(scalar(cols))), s = start === undefined ? 1 : toNum(scalar(start)), st = step === undefined ? 1 : toNum(scalar(step));
    if (h < 1 || w < 1 || h * w > 100000) throw E.VALUE();
    var out = [], v = s; for (var r = 0; r < h; r++) { var row = []; for (var c = 0; c < w; c++) { row.push(v); v += st; } out.push(row); }
    return new Mat(out);
  };
  FN.TAKE = function (arr, r, c) { arr = asMat(arr); var rn = r === undefined || r === null ? arr.h : Math.floor(toNum(scalar(r))); var cn = c === undefined || c === null ? arr.w : Math.floor(toNum(scalar(c))); var rows = rn >= 0 ? arr.rows.slice(0, rn) : arr.rows.slice(rn); rows = rows.map(function (row) { return cn >= 0 ? row.slice(0, cn) : row.slice(cn); }); if (!rows.length) throw E.CALC(); return new Mat(rows); };
  FN.DROP = function (arr, r, c) { arr = asMat(arr); var rn = r === undefined || r === null ? 0 : Math.floor(toNum(scalar(r))); var cn = c === undefined || c === null ? 0 : Math.floor(toNum(scalar(c))); var rows = rn >= 0 ? arr.rows.slice(rn) : arr.rows.slice(0, arr.h + rn); rows = rows.map(function (row) { return cn >= 0 ? row.slice(cn) : row.slice(0, arr.w + cn); }); if (!rows.length || !rows[0].length) throw E.CALC(); return new Mat(rows); };
  FN.CHOOSECOLS = function (arr) { arr = asMat(arr); var idx = Array.prototype.slice.call(arguments, 1).map(function (i) { return Math.floor(toNum(scalar(i))); }); return new Mat(arr.rows.map(function (row) { return idx.map(function (i) { if (i < 1 || i > arr.w) throw E.VALUE(); return row[i - 1]; }); })); };
  FN.CHOOSEROWS = function (arr) { arr = asMat(arr); var idx = Array.prototype.slice.call(arguments, 1).map(function (i) { return Math.floor(toNum(scalar(i))); }); return new Mat(idx.map(function (i) { if (i < 1 || i > arr.h) throw E.VALUE(); return arr.rows[i - 1].slice(); })); };
  FN.HSTACK = function () { var ms = Array.prototype.map.call(arguments, asMat); var h = Math.max.apply(null, ms.map(function (m) { return m.h; })); var out = []; for (var r = 0; r < h; r++) { var row = []; ms.forEach(function (m) { for (var c = 0; c < m.w; c++) row.push(r < m.h ? m.rows[r][c] : E.NA()); }); out.push(row); } return new Mat(out); };
  FN.VSTACK = function () { var ms = Array.prototype.map.call(arguments, asMat); var w = Math.max.apply(null, ms.map(function (m) { return m.w; })); var out = []; ms.forEach(function (m) { m.rows.forEach(function (row) { var r = row.slice(); while (r.length < w) r.push(E.NA()); out.push(r); }); }); return new Mat(out); };
  FN.TOCOL = function (arr) { return new Mat(flat(asMat(arr)).map(function (v) { return [v]; })); };
  FN.TOROW = function (arr) { return new Mat([flat(asMat(arr))]); };
  FN.GROUPBY = function (rowField, values, fn) {
    // Excel 365 GROUPBY(row_field, values, function) — the simple form, with a total-free output
    rowField = asMat(rowField); values = asMat(values);
    var f = FN[fn && fn.__name] ? FN[fn.__name] : null; // functions can't be passed here; use a name string instead
    throw E.NAME('GROUPBY is not supported in this Lab; use UNIQUE + SUMIFS, or a PivotTable in Excel.');
  };
  // text
  FN.LEN = function (x) { return map1(x, function (v) { return toStr(v).length; }); };
  FN.LEFT = function (x, n) { return broadcast(x, n === undefined ? 1 : n, function (a, b) { return toStr(a).slice(0, Math.max(0, Math.floor(toNum(b)))); }); };
  FN.RIGHT = function (x, n) { return broadcast(x, n === undefined ? 1 : n, function (a, b) { var s = toStr(a), k = Math.max(0, Math.floor(toNum(b))); return k ? s.slice(-k) : ''; }); };
  FN.MID = function (x, s, n) { return map1(x, function (a) { var st = Math.floor(toNum(scalar(s))), k = Math.floor(toNum(scalar(n))); if (st < 1 || k < 0) throw E.VALUE(); return toStr(a).substr(st - 1, k); }); };
  FN.UPPER = function (x) { return map1(x, function (v) { return toStr(v).toUpperCase(); }); };
  FN.LOWER = function (x) { return map1(x, function (v) { return toStr(v).toLowerCase(); }); };
  FN.PROPER = function (x) { return map1(x, function (v) { return toStr(v).toLowerCase().replace(/(^|[^a-z0-9])([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); }); }); };
  FN.TRIM = function (x) { return map1(x, function (v) { return toStr(v).replace(/\s+/g, ' ').trim(); }); };
  FN.CLEAN = function (x) { return map1(x, function (v) { return toStr(v).replace(/[\x00-\x1F]/g, ''); }); };
  FN.CONCAT = function () { var s = ''; Array.prototype.forEach.call(arguments, function (a) { flat(a).forEach(function (v) { s += toStr(v); }); }); return s; };
  FN.CONCATENATE = function () { var s = ''; Array.prototype.forEach.call(arguments, function (a) { s += toStr(scalar(a)); }); return s; };
  FN.TEXTJOIN = function (delim, ignoreEmpty) { var d = toStr(scalar(delim)), ie = toBool(scalar(ignoreEmpty)); var parts = []; Array.prototype.slice.call(arguments, 2).forEach(function (a) { flat(a).forEach(function (v) { if (ie && isBlank(v)) return; parts.push(toStr(v)); }); }); return parts.join(d); };
  FN.SUBSTITUTE = function (x, oldT, newT, inst) { return map1(x, function (v) { var s = toStr(v), o = toStr(scalar(oldT)), n = toStr(scalar(newT)); if (o === '') return s; if (inst === undefined) return s.split(o).join(n); var k = Math.floor(toNum(scalar(inst))), idx = -1; for (var i = 0; i < k; i++) { idx = s.indexOf(o, idx + 1); if (idx < 0) return s; } return s.slice(0, idx) + n + s.slice(idx + o.length); }); };
  FN.REPLACE = function (x, start, n, newT) { return map1(x, function (v) { var s = toStr(v), st = Math.floor(toNum(scalar(start))), k = Math.floor(toNum(scalar(n))); return s.slice(0, st - 1) + toStr(scalar(newT)) + s.slice(st - 1 + k); }); };
  FN.FIND = function (needle, hay, start) { return broadcast(needle, hay, function (a, b) { var st = start === undefined ? 1 : Math.floor(toNum(scalar(start))); var i = toStr(b).indexOf(toStr(a), st - 1); if (i < 0) throw E.VALUE('"' + toStr(a) + '" was not found.'); return i + 1; }); };
  FN.SEARCH = function (needle, hay, start) { return broadcast(needle, hay, function (a, b) { var st = start === undefined ? 1 : Math.floor(toNum(scalar(start))); var n = toStr(a), h = toStr(b); var re = new RegExp(n.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.'), 'i'); var m = re.exec(h.slice(st - 1)); if (!m) throw E.VALUE('"' + n + '" was not found.'); return m.index + st; }); };
  FN.EXACT = function (a, b) { return broadcast(a, b, function (x, y) { return toStr(x) === toStr(y); }); };
  FN.REPT = function (x, n) { return broadcast(x, n, function (a, b) { var k = Math.floor(toNum(b)); if (k < 0 || k > 10000) throw E.VALUE(); return new Array(k + 1).join(toStr(a)); }); };
  FN.CHAR = function (n) { return map1(n, function (v) { return String.fromCharCode(Math.floor(toNum(v))); }); };
  FN.CODE = FN.UNICODE = function (s) { return map1(s, function (v) { var t = toStr(v); if (!t) throw E.VALUE(); return t.charCodeAt(0); }); };
  FN.UNICHAR = FN.CHAR;
  FN.T = function (x) { x = scalar(x); return typeof x === 'string' ? x : ''; };
  FN.VALUE = FN.NUMBERVALUE = function (x) { return map1(x, function (v) { if (typeof v === 'number') return v; var s = toStr(v).trim().replace(/[₹,\s]/g, ''); if (s === '') throw E.VALUE(); var pct = /%$/.test(s); var n = Number(s.replace(/%$/, '')); if (isNaN(n)) { var d = parseDateText(toStr(v).trim()); if (d !== null) return d; throw E.VALUE('"' + toStr(v) + '" cannot be converted to a number.'); } return pct ? n / 100 : n; }); };
  FN.TEXT = function (x, fmt) { return map1(x, function (v) { var f = toStr(scalar(fmt)); if (typeof v === 'string') { var n = Number(v); if (v.trim() === '' || isNaN(n)) return v; v = n; } if (isBlank(v)) v = 0; if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'; return formatNumber(v, f); }); };
  FN.FIXED = function (x, d, noCommas) { return map1(x, function (v) { var dec = d === undefined ? 2 : Math.floor(toNum(scalar(d))); return formatNumber(toNum(v), (noCommas && toBool(scalar(noCommas)) ? '0' : '#,##0') + (dec > 0 ? '.' + new Array(dec + 1).join('0') : '')); }); };
  FN.TEXTBEFORE = function (x, delim, inst) { return map1(x, function (v) { var s = toStr(v), d = toStr(scalar(delim)); var k = inst === undefined ? 1 : Math.floor(toNum(scalar(inst))); var idx = -1; if (k > 0) { for (var i = 0; i < k; i++) { idx = s.indexOf(d, idx + 1); if (idx < 0) throw E.NA(); } } else { idx = s.length; for (var j = 0; j < -k; j++) { idx = s.lastIndexOf(d, idx - 1); if (idx < 0) throw E.NA(); } } return s.slice(0, idx); }); };
  FN.TEXTAFTER = function (x, delim, inst) { return map1(x, function (v) { var s = toStr(v), d = toStr(scalar(delim)); var k = inst === undefined ? 1 : Math.floor(toNum(scalar(inst))); var idx = -1; if (k > 0) { for (var i = 0; i < k; i++) { idx = s.indexOf(d, idx + 1); if (idx < 0) throw E.NA(); } } else { idx = s.length; for (var j = 0; j < -k; j++) { idx = s.lastIndexOf(d, idx - 1); if (idx < 0) throw E.NA(); } } return s.slice(idx + d.length); }); };
  FN.TEXTSPLIT = function (x, colDelim, rowDelim) { var s = toStr(scalar(x)); var rd = rowDelim === undefined || rowDelim === null ? null : toStr(scalar(rowDelim)); var cd = colDelim === undefined || colDelim === null ? null : toStr(scalar(colDelim)); var rows = rd ? s.split(rd) : [s]; var out = rows.map(function (r) { return cd ? r.split(cd) : [r]; }); var w = Math.max.apply(null, out.map(function (r) { return r.length; })); out.forEach(function (r) { while (r.length < w) r.push(E.NA()); }); return new Mat(out); };
  FN.LEN = FN.LEN;
  // dates
  FN.TODAY = function () { return WB && WB.asOf ? WB.asOf : dateToSerial(2026, 8, 31); };
  FN.NOW = function () { return FN.TODAY() + 0.5; };
  FN.DATE = function (y, m, d) { return broadcast(broadcast(y, m, function (a, b) { return [toNum(a), toNum(b)]; }), d, function (ym, dd) { var yy = Math.floor(ym[0]), mm = Math.floor(ym[1]), day = Math.floor(toNum(dd)); if (yy < 1900) yy += 1900; return dateToSerial(yy, mm, day); }); };
  FN.YEAR = function (x) { return map1(x, function (v) { return ymd(toNum(v)).y; }); };
  FN.MONTH = function (x) { return map1(x, function (v) { return ymd(toNum(v)).m; }); };
  FN.DAY = function (x) { return map1(x, function (v) { return ymd(toNum(v)).d; }); };
  FN.WEEKDAY = function (x, type) { var t = type === undefined ? 1 : toNum(scalar(type)); return map1(x, function (v) { var dow = ymd(toNum(v)).dow; if (t === 1 || t === 17) return dow + 1; if (t === 2 || t === 11) return dow === 0 ? 7 : dow; if (t === 3) return dow === 0 ? 6 : dow - 1; return dow + 1; }); };
  FN.WEEKNUM = function (x) { return map1(x, function (v) { var n = toNum(v), t = ymd(n); var jan1 = dateToSerial(t.y, 1, 1); var dow1 = ymd(jan1).dow; return Math.floor((n - jan1 + dow1) / 7) + 1; }); };
  FN.EOMONTH = function (x, months) { return broadcast(x, months === undefined ? 0 : months, function (a, b) { var t = ymd(toNum(a)); var m = t.m + Math.floor(toNum(b)); var y = t.y + Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return dateToSerial(y, m + 1, 0); }); };
  FN.EDATE = function (x, months) { return broadcast(x, months, function (a, b) { var t = ymd(toNum(a)); var m = t.m + Math.floor(toNum(b)); var y = t.y + Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; var last = ymd(dateToSerial(y, m + 1, 0)).d; return dateToSerial(y, m, Math.min(t.d, last)); }); };
  FN.DAYS = function (end, start) { return broadcast(end, start, function (a, b) { return toNum(a) - toNum(b); }); };
  FN.DATEDIF = function (start, end, unit) {
    var u = toStr(scalar(unit)).toUpperCase();
    return broadcast(start, end, function (a, b) {
      var s = toNum(a), e = toNum(b); if (e < s) throw E.NUM('DATEDIF: the start date is after the end date.');
      var ts = ymd(s), te = ymd(e);
      var months = (te.y - ts.y) * 12 + (te.m - ts.m) - (te.d < ts.d ? 1 : 0);
      if (u === 'D') return e - s;
      if (u === 'M') return months;
      if (u === 'Y') return Math.floor(months / 12);
      if (u === 'YM') return months % 12;
      if (u === 'MD') { var d = te.d - ts.d; if (d < 0) { var prev = ymd(dateToSerial(te.y, te.m, 0)); d += prev.d; } return d; }
      if (u === 'YD') { var anchor = dateToSerial(te.y - (te.m < ts.m || (te.m === ts.m && te.d < ts.d) ? 1 : 0), ts.m, ts.d); return e - anchor; }
      throw E.VALUE('DATEDIF unit must be D, M, Y, YM, MD or YD.');
    });
  };
  FN.NETWORKDAYS = function (start, end, holidays) {
    var hol = {}; if (holidays !== undefined) flat(holidays).forEach(function (h) { if (typeof h === 'number') hol[Math.floor(h)] = 1; });
    return broadcast(start, end, function (a, b) { var s = toNum(a), e = toNum(b), sign = 1; if (e < s) { var t = s; s = e; e = t; sign = -1; } var n = 0; for (var d = s; d <= e; d++) { var dow = ymd(d).dow; if (dow !== 0 && dow !== 6 && !hol[d]) n++; } return sign * n; });
  };
  FN.WORKDAY = function (start, days, holidays) {
    var hol = {}; if (holidays !== undefined) flat(holidays).forEach(function (h) { if (typeof h === 'number') hol[Math.floor(h)] = 1; });
    return broadcast(start, days, function (a, b) { var d = toNum(a), n = Math.floor(toNum(b)), step = n < 0 ? -1 : 1; n = Math.abs(n); while (n > 0) { d += step; var dow = ymd(d).dow; if (dow !== 0 && dow !== 6 && !hol[d]) n--; } return d; });
  };
  FN.DATEVALUE = function (x) { return map1(x, function (v) { var d = parseDateText(toStr(v).trim()); if (d === null) throw E.VALUE('"' + toStr(v) + '" is not a date this Lab recognises (try yyyy-mm-dd or dd/mm/yyyy).'); return d; }); };
  FN.YEARFRAC = function (a, b) { return broadcast(a, b, function (x, y) { return Math.abs(toNum(y) - toNum(x)) / 365; }); };
  FN.TIME = function (h, m, s) { return (toNum(scalar(h)) * 3600 + toNum(scalar(m)) * 60 + toNum(scalar(s))) / 86400; };
  FN.HOUR = function (x) { return map1(x, function (v) { var f = toNum(v) % 1; return Math.floor(f * 24); }); };
  FN.MINUTE = function (x) { return map1(x, function (v) { var f = toNum(v) % 1; return Math.floor(f * 1440) % 60; }); };
  // financial
  FN.PMT = function (rate, nper, pv, fv, type) { rate = toNum(scalar(rate)); nper = toNum(scalar(nper)); pv = toNum(scalar(pv)); fv = fv === undefined ? 0 : toNum(scalar(fv)); type = type === undefined ? 0 : toNum(scalar(type)); if (rate === 0) return -(pv + fv) / nper; var f = Math.pow(1 + rate, nper); return -(rate * (pv * f + fv)) / ((1 + rate * type) * (f - 1)); };
  FN.FV = function (rate, nper, pmt, pv, type) { rate = toNum(scalar(rate)); nper = toNum(scalar(nper)); pmt = toNum(scalar(pmt)); pv = pv === undefined ? 0 : toNum(scalar(pv)); type = type === undefined ? 0 : toNum(scalar(type)); if (rate === 0) return -(pv + pmt * nper); var f = Math.pow(1 + rate, nper); return -(pv * f + pmt * (1 + rate * type) * (f - 1) / rate); };
  FN.PV = function (rate, nper, pmt, fv, type) { rate = toNum(scalar(rate)); nper = toNum(scalar(nper)); pmt = toNum(scalar(pmt)); fv = fv === undefined ? 0 : toNum(scalar(fv)); type = type === undefined ? 0 : toNum(scalar(type)); if (rate === 0) return -(fv + pmt * nper); var f = Math.pow(1 + rate, nper); return -(fv + pmt * (1 + rate * type) * (f - 1) / rate) / f; };
  FN.NPER = function (rate, pmt, pv, fv, type) { rate = toNum(scalar(rate)); pmt = toNum(scalar(pmt)); pv = toNum(scalar(pv)); fv = fv === undefined ? 0 : toNum(scalar(fv)); type = type === undefined ? 0 : toNum(scalar(type)); if (rate === 0) return -(pv + fv) / pmt; var z = pmt * (1 + rate * type) / rate; return Math.log((-fv + z) / (pv + z)) / Math.log(1 + rate); };
  FN.RATE = function (nper, pmt, pv, fv) { nper = toNum(scalar(nper)); pmt = toNum(scalar(pmt)); pv = toNum(scalar(pv)); fv = fv === undefined ? 0 : toNum(scalar(fv)); var r = 0.1; for (var i = 0; i < 100; i++) { var f = Math.pow(1 + r, nper); var y = pv * f + pmt * (f - 1) / r + fv; var dy = nper * pv * Math.pow(1 + r, nper - 1) + pmt * (nper * Math.pow(1 + r, nper - 1) * r - (f - 1)) / (r * r); var nr = r - y / dy; if (Math.abs(nr - r) < 1e-10) return nr; r = nr; } return r; };
  FN.NPV = function (rate) { rate = toNum(scalar(rate)); var flows = nums(Array.prototype.slice.call(arguments, 1)); return flows.reduce(function (s, cf, i) { return s + cf / Math.pow(1 + rate, i + 1); }, 0); };
  FN.IRR = function (values, guess) { var cf = nums([values]); var r = guess === undefined ? 0.1 : toNum(scalar(guess)); for (var i = 0; i < 200; i++) { var npv = 0, d = 0; for (var k = 0; k < cf.length; k++) { npv += cf[k] / Math.pow(1 + r, k); d -= k * cf[k] / Math.pow(1 + r, k + 1); } if (Math.abs(npv) < 1e-7) return r; if (d === 0) break; var nr = r - npv / d; if (!isFinite(nr)) break; if (Math.abs(nr - r) < 1e-10) return nr; r = nr; } throw E.NUM('IRR did not converge.'); };
  FN.SLN = function (cost, salvage, life) { return (toNum(scalar(cost)) - toNum(scalar(salvage))) / toNum(scalar(life)); };
  // forecasting (linear)
  function linfit(ys, xs) { var n = ys.length; if (n !== xs.length || n < 2) throw E.NA(); var mx = sumOf(xs) / n, my = sumOf(ys) / n, num = 0, den = 0; for (var i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) * (xs[i] - mx); } if (den === 0) throw E.DIV0(); var b = num / den; return { m: b, c: my - b * mx }; }
  FN.SLOPE = function (ys, xs) { return linfit(nums([ys]), nums([xs])).m; };
  FN.INTERCEPT = function (ys, xs) { return linfit(nums([ys]), nums([xs])).c; };
  FN.FORECAST = FN['FORECAST.LINEAR'] = function (x, ys, xs) { var f = linfit(nums([ys]), nums([xs])); return map1(x, function (v) { return f.c + f.m * toNum(v); }); };
  FN.CORREL = function (a, b) { var x = nums([a]), y = nums([b]); var n = x.length; if (n !== y.length || n < 2) throw E.NA(); var mx = sumOf(x) / n, my = sumOf(y) / n, sxy = 0, sxx = 0, syy = 0; for (var i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx); syy += (y[i] - my) * (y[i] - my); } if (!sxx || !syy) throw E.DIV0(); return sxy / Math.sqrt(sxx * syy); };
  FN.RSQ = function (a, b) { var r = FN.CORREL(a, b); return r * r; };
  FN.TREND = function (ys, xs, newXs) { var y = nums([ys]); var x = xs === undefined ? y.map(function (_, i) { return i + 1; }) : nums([xs]); var f = linfit(y, x); var nx = newXs === undefined ? x : nums([newXs]); return new Mat(nx.map(function (v) { return [f.c + f.m * v]; })); };

  /* ---------------- display helpers ---------------- */
  function display(v, hint) {
    if (isErr(v)) return v.code;
    if (isBlank(v)) return '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') {
      if (hint === 'date') { var t = ymd(v); return pad2(t.d) + '-' + MONTHS[t.m - 1].slice(0, 3) + '-' + t.y; }
      if (hint === 'bool') return v ? 'TRUE' : 'FALSE';
      return general(v);
    }
    return String(v);
  }
  /* Excel's General format: up to 12 significant digits, no separators, float noise trimmed. */
  function general(v) {
    if (!isFinite(v)) return '#NUM!';
    if (Number.isInteger(v)) return String(v);
    var r = Number(v.toPrecision(12));
    return String(r);
  }
  /* Indian-style grouping with two decimals, for the secondary readout in the Lab. */
  function indian(v) {
    var neg = v < 0; v = Math.abs(v);
    var f = v.toFixed(2), parts = f.split('.'), ip = parts[0];
    var last3 = ip.slice(-3), rest = ip.slice(0, -3);
    if (rest) ip = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
    return (neg ? '-' : '') + ip + '.' + parts[1];
  }
  function functionList() { return Object.keys(FN).concat(Object.keys(LAZY)).sort(); }

  root.XL = { evaluate: evaluate, general: general, indian: indian, parse: parse, setWorkbook: setWorkbook, Mat: Mat, isMat: isMat, isErr: isErr, XErr: XErr, display: display, functions: functionList, numToCol: numToCol, colToNum: colToNum, ymd: ymd, serialToDate: serialToDate, dateToSerial: dateToSerial, flat: flat, cmp: cmp, getWorkbook: function () { return WB; } };
})(typeof window !== 'undefined' ? window : globalThis);
