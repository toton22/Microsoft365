/* Microsoft 365 for Managers — router, live formula runner, Formula Lab, search, progress. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var SITE = 'Microsoft 365 for Managers';

  /* ---------------- site map ---------------- */
  var NAV = [
    { label: 'Orientation', items: [
      { id: 'home', num: '', title: 'Start here' },
      { id: 'mindmap', num: '', title: 'How Microsoft 365 runs a company' },
      { id: 'routes', num: '', title: 'Routes into Microsoft 365' }
    ] },
    { label: 'Level 1 · Foundations', items: [
      { id: 'm01-workspace', num: '01', title: 'The M365 workspace', mod: true },
      { id: 'm02-excel-basics', num: '02', title: 'Excel foundations', mod: true },
      { id: 'm03-formulas', num: '03', title: 'Formulas that run a business', mod: true },
      { id: 'm04-lookups', num: '04', title: 'Lookups and validation', mod: true },
      { id: 'm05-pivots', num: '05', title: 'PivotTables', mod: true }
    ] },
    { label: 'Level 2 · Intermediate', items: [
      { id: 'm06-power-query', num: '06', title: 'Power Query', mod: true },
      { id: 'm07-dashboards', num: '07', title: 'Charts and dashboards', mod: true },
      { id: 'm08-word', num: '08', title: 'Word for business documents', mod: true },
      { id: 'm09-powerpoint', num: '09', title: 'PowerPoint that gets decisions', mod: true },
      { id: 'm10-outlook-teams', num: '10', title: 'Outlook and Teams', mod: true }
    ] },
    { label: 'Level 3 · Advanced', items: [
      { id: 'm11-forms-lists-planner', num: '11', title: 'Forms, Lists and Planner', mod: true },
      { id: 'm12-power-automate', num: '12', title: 'Power Automate', mod: true },
      { id: 'm13-modelling', num: '13', title: 'Excel modelling and the Data Model', mod: true },
      { id: 'm14-copilot-career', num: '14', title: 'Copilot, certification, the job test', mod: true }
    ] },
    { label: 'Build and reference', items: [
      { id: 'capstones', num: '', title: 'Capstone projects' },
      { id: 'lab', num: '', title: 'Formula Lab' },
      { id: 'cheatsheet', num: '', title: 'Cheat sheet' }
    ] }
  ];
  var ORDER = [], BY_ID = {};
  NAV.forEach(function (g) { g.items.forEach(function (it) { it.group = g.label; ORDER.push(it); BY_ID[it.id] = it; }); });
  var MODULES = ORDER.filter(function (i) { return i.mod; });

  /* ---------------- storage ---------------- */
  function load(key, fallback) {
    try { var v = localStorage.getItem('m365mgr.' + key); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem('m365mgr.' + key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }
  var progress = load('progress', {}) || {};

  /* ---------------- icons ---------------- */
  var I = {
    play: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 2.7v10.6c0 .5.6.9 1 .6l8.3-5.3c.4-.3.4-.9 0-1.2L5.5 2.1c-.4-.3-1 0-1 .6z"/></svg>',
    copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5v-1a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h1"/></svg>',
    lab: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="1.2"/><path d="M1.5 6h13M1.5 9.5h13M5.5 6v7.5M10 6v7.5"/></svg>',
    tick: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5"/></svg>',
    sun: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M8 .8v1.8M8 13.4v1.8M15.2 8h-1.8M2.6 8H.8M13.1 13.1l-1.3-1.3M4.2 4.2 2.9 2.9M13.1 2.9l-1.3 1.3M4.2 11.8l-1.3 1.3"/></svg>',
    moon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1z"/></svg>'
  };

  /* ---------------- syntax highlighting ---------------- */
  var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var XL_TOK = /("(?:[^"]|"")*")|('(?:[^']|'')*'![A-Za-z$]+\d*(?::[A-Za-z$]+\d*)?)|(\b[A-Za-z_][A-Za-z0-9_]*!\$?[A-Za-z]{1,3}\$?\d*(?::\$?[A-Za-z]{1,3}\$?\d*)?)|(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3})(?![A-Za-z0-9_(])|(\b\d+(?:\.\d+)?(?:[eE][-+]?\d+)?%?)|([A-Za-z_][A-Za-z0-9_.]*)(?=\s*\()|(TRUE|FALSE)\b|([-+*/^&=<>%,;:(){}]+)|(\[[^\]]*\])/g;
  function highlightXl(src) {
    var out = '', last = 0, m;
    XL_TOK.lastIndex = 0;
    while ((m = XL_TOK.exec(src))) {
      out += esc(src.slice(last, m.index));
      last = m.index + m[0].length;
      if (m[1]) out += '<span class="tk-str">' + esc(m[1]) + '</span>';
      else if (m[2] || m[3] || m[4]) out += '<span class="tk-key">' + esc(m[0]) + '</span>';
      else if (m[5]) out += '<span class="tk-num">' + esc(m[5]) + '</span>';
      else if (m[6]) out += '<span class="tk-fn">' + esc(m[6]) + '</span>';
      else if (m[7]) out += '<span class="tk-num">' + esc(m[7]) + '</span>';
      else if (m[8]) out += '<span class="tk-op">' + esc(m[8]) + '</span>';
      else if (m[9]) out += '<span class="tk-key">' + esc(m[9]) + '</span>';
      else out += esc(m[0]);
    }
    return out + esc(src.slice(last));
  }
  var LANG_KW = {
    M: 'let in each if then else and or not true false null type table text number date meta as is try otherwise',
    DAX: 'CALCULATE FILTER ALL ALLEXCEPT VAR RETURN SUMX AVERAGEX COUNTROWS DISTINCTCOUNT RELATED DIVIDE SAMEPERIODLASTYEAR DATEADD TOTALYTD VALUES SELECTEDVALUE BLANK IF SWITCH TRUE FALSE MEASURE EVALUATE',
    Expression: 'utcNow formatDateTime concat items body outputs triggerBody triggerOutputs variables if equals greater less and or not empty length first last addDays',
    VBA: 'Sub End Function Dim As If Then Else ElseIf For Each Next To Step While Wend Do Loop Set With Range Cells Worksheets ActiveSheet MsgBox True False Integer Long String Double Boolean Exit'
  };
  function highlightLang(src, lang) {
    var kw = {}; (LANG_KW[lang] || '').split(' ').forEach(function (k) { kw[k.toLowerCase()] = 1; });
    var TOK = /(\/\/[^\n]*|'[^\n]*(?=\n|$)|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_.]*)|([-+*/%<>=!|,;().{}\[\]&]+)/g;
    var out = '', last = 0, m;
    while ((m = TOK.exec(src))) {
      out += esc(src.slice(last, m.index)); last = m.index + m[0].length;
      if (m[1] && (lang === 'VBA' || m[1].charAt(0) !== "'")) out += '<span class="tk-com">' + esc(m[1]) + '</span>';
      else if (m[1]) out += esc(m[1]);
      else if (m[2]) out += '<span class="tk-str">' + esc(m[2]) + '</span>';
      else if (m[3]) out += '<span class="tk-num">' + esc(m[3]) + '</span>';
      else if (m[4]) { if (kw[m[4].toLowerCase()]) out += '<span class="tk-key">' + esc(m[4]) + '</span>'; else if (src.charAt(last) === '(') out += '<span class="tk-fn">' + esc(m[4]) + '</span>'; else out += esc(m[4]); }
      else if (m[5]) out += '<span class="tk-op">' + esc(m[5]) + '</span>';
    }
    return out + esc(src.slice(last));
  }

  /* ---------------- engine ---------------- */
  var XL = window.XL, WB = null;
  function ensureWorkbook() {
    if (WB) return WB;
    WB = window.NovamartData.buildWorkbook();
    XL.setWorkbook(WB);
    return WB;
  }
  function run(formula) {
    ensureWorkbook();
    var t0 = performance.now(), v;
    try { v = XL.evaluate(formula); }
    catch (e) { if (XL.isErr(e)) v = e; else v = new XL.XErr('#VALUE!', e && e.message ? e.message : 'The formula could not be evaluated.'); }
    return { value: v, ms: Math.max(1, Math.round(performance.now() - t0)) };
  }

  /* ---------------- result rendering ---------------- */
  var MAX_ROWS = 300;
  function looksLikeDate(v) { return typeof v === 'number' && Number.isInteger(v) && v >= 36526 && v <= 47848; }
  function cellText(v) { return XL.display(v); }
  function cellClass(v) {
    if (XL.isErr(v)) return 'nul';
    if (v === null || v === undefined || v === '') return 'nul';
    if (typeof v === 'number') return 'num';
    return '';
  }

  function renderResult(host, r) {
    host.hidden = false;
    if (!host.hasAttribute('aria-live')) { host.setAttribute('aria-live', 'polite'); host.setAttribute('aria-atomic', 'false'); }
    host.innerHTML = '';
    var v = r.value;
    if (r.type === 'error' || (XL.isErr(v))) {
      var e = document.createElement('div');
      e.className = 'result-err';
      e.textContent = r.type === 'error' ? r.message : v.code;
      if (XL.isErr(v) && v.msg) { var sm = document.createElement('small'); sm.textContent = v.msg; e.appendChild(sm); }
      host.appendChild(e);
      return;
    }
    if (XL.isMat(v)) {
      var rows = v.rows, shown = rows.slice(0, MAX_ROWS);
      var scroll = document.createElement('div'); scroll.className = 'result-scroll';
      var t = document.createElement('table'); t.className = 'grid';
      var thead = document.createElement('thead'), htr = document.createElement('tr');
      var th0 = document.createElement('th'); th0.className = 'rowno'; th0.textContent = '#'; htr.appendChild(th0);
      for (var c = 0; c < v.w; c++) { var th = document.createElement('th'); th.textContent = XL.numToCol(c + 1); htr.appendChild(th); }
      thead.appendChild(htr); t.appendChild(thead);
      var tb = document.createElement('tbody');
      shown.forEach(function (row, ri) {
        var tr = document.createElement('tr');
        var td0 = document.createElement('td'); td0.className = 'rowno'; td0.textContent = String(ri + 1); tr.appendChild(td0);
        row.forEach(function (cell) {
          var td = document.createElement('td');
          var cls = cellClass(cell); if (cls) td.className = cls;
          td.textContent = (cell === null || cell === undefined || cell === '') ? '' : cellText(cell);
          if (XL.isErr(cell)) td.textContent = cell.code;
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      t.appendChild(tb); scroll.appendChild(t); host.appendChild(scroll);
      var foot = document.createElement('div'); foot.className = 'result-foot';
      var n = document.createElement('span');
      n.innerHTML = 'spills <b>' + v.h + '</b> row' + (v.h === 1 ? '' : 's') + ' × <b>' + v.w + '</b> column' + (v.w === 1 ? '' : 's');
      foot.appendChild(n);
      if (rows.length > MAX_ROWS) { var more = document.createElement('span'); more.textContent = 'showing the first ' + MAX_ROWS; foot.appendChild(more); }
      var sp = document.createElement('span'); sp.className = 'spacer'; foot.appendChild(sp);
      var ms = document.createElement('span'); ms.innerHTML = '<b>' + r.ms + '</b> ms'; foot.appendChild(ms);
      host.appendChild(foot);
      return;
    }
    var box = document.createElement('div'); box.className = 'result-value';
    var val = document.createElement('span'); val.className = 'val';
    if (typeof v === 'string') { val.classList.add('txt'); val.textContent = v === '' ? '(empty text)' : v; }
    else if (typeof v === 'boolean') { val.classList.add('bool'); val.textContent = v ? 'TRUE' : 'FALSE'; }
    else if (v === null || v === undefined) { val.classList.add('txt'); val.textContent = '(blank)'; }
    else val.textContent = XL.general(v);
    box.appendChild(val);
    if (typeof v === 'number') {
      var alt = document.createElement('span'); alt.className = 'alt';
      var bits = [];
      if (Math.abs(v) >= 1000) bits.push('formatted <b>' + XL.indian(v) + '</b>');
      if (looksLikeDate(v)) bits.push('as a date <b>' + XL.display(v, 'date') + '</b>');
      if (Math.abs(v) < 1 && v !== 0 && !Number.isInteger(v)) bits.push('as a percentage <b>' + (Math.round(v * 10000) / 100) + '%</b>');
      if (bits.length) { alt.innerHTML = bits.join(' · '); box.appendChild(alt); }
    }
    host.appendChild(box);
    var foot2 = document.createElement('div'); foot2.className = 'result-foot';
    var kind = document.createElement('span'); kind.textContent = typeof v === 'number' ? 'number' : typeof v === 'string' ? 'text' : typeof v === 'boolean' ? 'logical' : 'blank';
    foot2.appendChild(kind);
    var sp2 = document.createElement('span'); sp2.className = 'spacer'; foot2.appendChild(sp2);
    var ms2 = document.createElement('span'); ms2.innerHTML = '<b>' + r.ms + '</b> ms'; foot2.appendChild(ms2);
    host.appendChild(foot2);
  }

  /* ---------------- formula block enhancement ---------------- */
  function textOf(pre) {
    var code = pre.querySelector('code');
    return (code ? code.textContent : pre.textContent).replace(/\s+$/, '');
  }
  function enhanceDiagrams(root) {
    $$('figure.diagram > svg', root).forEach(function (svg) {
      var box = document.createElement('div');
      box.className = 'diagram-scroll';
      svg.parentNode.insertBefore(box, svg);
      box.appendChild(svg);
    });
  }
  function enhanceXlBlocks(root) {
    $$('pre.xl', root).forEach(function (pre) {
      if (pre.dataset.done) return;
      pre.dataset.done = '1';
      var src = textOf(pre);
      var code = pre.querySelector('code') || pre;
      var lang = pre.getAttribute('data-lang');
      code.innerHTML = lang ? highlightLang(src, lang) : highlightXl(src);

      var wrap = document.createElement('div');
      wrap.className = 'xlblock';
      var norun = pre.hasAttribute('data-norun');
      if (norun) wrap.classList.add('norun');
      pre.parentNode.insertBefore(wrap, pre);

      var bar = document.createElement('div');
      bar.className = 'xl-toolbar';
      var cap = document.createElement('span');
      cap.className = 'xl-caption';
      cap.textContent = pre.getAttribute('data-caption') || (norun ? 'Reference' : 'Formula');
      bar.appendChild(cap);
      if (lang) { var lb = document.createElement('span'); lb.className = 'xl-badge lang'; lb.textContent = lang; bar.appendChild(lb); }
      else if (norun) { var nb = document.createElement('span'); nb.className = 'xl-badge'; nb.textContent = 'syntax'; bar.appendChild(nb); }

      var out = document.createElement('div');
      out.className = 'result';
      out.hidden = true;

      if (!norun) {
        var runBtn = document.createElement('button');
        runBtn.className = 'btn run'; runBtn.type = 'button';
        runBtn.innerHTML = I.play + '<span>Run</span>';
        runBtn.addEventListener('click', function () { renderResult(out, run(src)); });
        bar.appendChild(runBtn);
        var labBtn = document.createElement('button');
        labBtn.className = 'btn ghost'; labBtn.type = 'button';
        labBtn.title = 'Open this formula in the Formula Lab';
        labBtn.innerHTML = I.lab + '<span>Lab</span>';
        labBtn.addEventListener('click', function () { openInLab(src); });
        bar.appendChild(labBtn);
      }
      var copyBtn = document.createElement('button');
      copyBtn.className = 'btn ghost'; copyBtn.type = 'button';
      copyBtn.title = 'Copy'; copyBtn.innerHTML = I.copy;
      copyBtn.addEventListener('click', function () { copy(src); });
      bar.appendChild(copyBtn);

      wrap.appendChild(bar); wrap.appendChild(pre); wrap.appendChild(out);
    });
  }

  function copy(text) {
    var done = function () { toast('Copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Select the formula and copy it manually'); }
    document.body.removeChild(ta);
  }
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 1900);
  }

  /* ---------------- exercises ---------------- */
  function normCell(v) {
    if (XL.isErr(v)) return v.code;
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return Math.round(v * 1e4) / 1e4;
    if (typeof v === 'boolean') return v;
    return String(v).trim().toLowerCase();
  }
  function sameCell(a, b) {
    a = normCell(a); b = normCell(b);
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-6);
    return a === b;
  }
  function compareValues(mine, want) {
    var mm = XL.isMat(mine), wm = XL.isMat(want);
    if (XL.isErr(mine)) return { ok: false, why: 'Your formula returned ' + mine.code + '.' };
    if (!mm && !wm) return sameCell(mine, want) ? { ok: true, why: 'Matches the solution exactly.' } : { ok: false, why: 'The solution returns ' + XL.display(want) + (typeof want === 'number' && Math.abs(want) >= 1000 ? ' (' + XL.indian(want) + ')' : '') + '.' };
    if (mm !== wm) return { ok: false, why: wm ? 'The solution spills ' + want.h + ' × ' + want.w + '; yours is a single value.' : 'The solution is a single value; yours spills ' + mine.h + ' × ' + mine.w + '.' };
    if (mine.h !== want.h || mine.w !== want.w) return { ok: false, why: 'Shape differs — yours is ' + mine.h + ' × ' + mine.w + ', the solution is ' + want.h + ' × ' + want.w + '.' };
    var exact = true;
    for (var r = 0; r < want.h && exact; r++) for (var c = 0; c < want.w; c++) if (!sameCell(mine.rows[r][c], want.rows[r][c])) { exact = false; break; }
    if (exact) return { ok: true, why: 'Matches the solution exactly.' };
    var key = function (row) { return JSON.stringify(row.map(normCell)); };
    var a = mine.rows.map(key).sort(), b = want.rows.map(key).sort(), same = true;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; }
    if (same) return { ok: true, why: 'Same rows and values in a different order. Add SORT or SORTBY to match exactly.' };
    return { ok: false, why: 'Same shape, but some values differ. Compare your output with the solution below.' };
  }

  function makeEditor(id, placeholder) {
    var ta = document.createElement('textarea');
    ta.id = id; ta.setAttribute('spellcheck', 'false'); ta.setAttribute('aria-label', 'Your formula');
    ta.style.cssText = 'width:100%;min-height:74px;resize:vertical;border:0;border-bottom:1px solid var(--line);padding:12px 14px;font-family:var(--font-mono);font-size:13.4px;line-height:1.6;background:var(--surface);color:var(--ink);outline:none;display:block';
    ta.value = placeholder || '';
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') { e.preventDefault(); var s = ta.selectionStart, t2 = ta.selectionEnd; ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(t2); ta.selectionStart = ta.selectionEnd = s + 2; }
    });
    return ta;
  }

  function enhanceExercises(root) {
    $$('.exercise', root).forEach(function (ex) {
      if (ex.dataset.done) return;
      ex.dataset.done = '1';
      var solPre = ex.querySelector('.solution pre.xl[data-solution]');
      if (!solPre || solPre.hasAttribute('data-norun')) return;
      var solution = textOf(solPre);

      var actions = document.createElement('div'); actions.className = 'ex-actions';
      var tryBtn = document.createElement('button'); tryBtn.className = 'btn'; tryBtn.type = 'button';
      tryBtn.innerHTML = I.play + '<span>Write your answer</span>';
      actions.appendChild(tryBtn);

      var panel = document.createElement('div'); panel.className = 'editor-pane'; panel.hidden = true;
      var ta = makeEditor(ex.id + '-editor', '=');
      var bar2 = document.createElement('div'); bar2.className = 'lab-bar';
      var runB = document.createElement('button'); runB.className = 'btn run'; runB.type = 'button'; runB.innerHTML = I.play + '<span>Run</span>';
      var checkB = document.createElement('button'); checkB.className = 'btn'; checkB.type = 'button'; checkB.innerHTML = I.tick + '<span>Check answer</span>';
      bar2.appendChild(runB); bar2.appendChild(checkB);
      var out = document.createElement('div'); out.className = 'result'; out.hidden = true;
      panel.appendChild(ta); panel.appendChild(bar2); panel.appendChild(out);

      var details = ex.querySelector('details.hint') || ex.querySelector('details.solution');
      ex.insertBefore(actions, details); ex.insertBefore(panel, details);

      tryBtn.addEventListener('click', function () { panel.hidden = false; tryBtn.style.display = 'none'; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); });
      function doRun() {
        var q = ta.value.trim();
        if (!q || q === '=') { renderResult(out, { type: 'error', message: 'Type a formula first.' }); return null; }
        var r = run(q); renderResult(out, r); return r;
      }
      runB.addEventListener('click', doRun);
      checkB.addEventListener('click', function () {
        var mine = doRun(); if (!mine) return;
        var want = run(solution);
        var verdict = XL.isErr(want.value) ? { ok: false, why: 'The solution could not be run for comparison.' } : compareValues(mine.value, want.value);
        var msg = document.createElement('div');
        msg.className = 'result-msg' + (verdict.ok ? ' ok' : '');
        msg.textContent = (verdict.ok ? 'Correct. ' : 'Not quite. ') + verdict.why;
        out.insertBefore(msg, out.firstChild);
      });
      ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doRun(); } });
    });
  }

  /* ---------------- quiz ---------------- */
  function enhanceQuiz(root) {
    $$('.q', root).forEach(function (q) {
      if (q.dataset.done) return;
      q.dataset.done = '1';
      var answer = q.getAttribute('data-answer');
      $$('input[type="radio"]', q).forEach(function (input) {
        input.addEventListener('change', function () {
          q.classList.add('answered');
          $$('label', q).forEach(function (l) {
            l.classList.remove('right', 'wrong');
            var i = l.querySelector('input'); if (!i) return;
            if (i.value === answer) l.classList.add('right'); else if (i.checked) l.classList.add('wrong');
          });
        });
      });
    });
  }

  /* ---------------- Formula Lab ---------------- */
  var LAB_SAMPLES = [
    ['Total revenue, all lines', '=SUM(Sales!P:P)'],
    ['Delivered revenue from the app', '=SUMIFS(Sales!P:P,Sales!G:G,"App",Sales!Q:Q,"Delivered")'],
    ['Revenue by channel (spills)', '=LET(k,SORT(UNIQUE(Sales!G2:G6315)),\n     HSTACK(k,SUMIFS(Sales!P:P,Sales!G:G,k)))'],
    ['Revenue in October 2025', '=SUMIFS(Sales!P:P,Sales!C:C,"2025-10")'],
    ['Store name for a city', '=XLOOKUP("Kochi",Stores!C:C,Stores!B:B,"not found")'],
    ['Top 5 products by revenue', '=LET(p,UNIQUE(Sales!J2:J6315),\n     r,SUMIFS(Sales!P:P,Sales!J:J,p),\n     TAKE(SORTBY(HSTACK(p,r),r,-1),5))'],
    ['Stores below target, July 2026', '=LET(s,Stores!B2:B13,\n     a,SUMIFS(Sales!P:P,Sales!D:D,s,Sales!C:C,"2026-07",Sales!Q:Q,"Delivered"),\n     t,SUMIFS(Targets!D:D,Targets!B:B,s,Targets!C:C,"2026-07"),\n     FILTER(HSTACK(s,a,t,ROUND(a/t,2)),a<t,"none"))'],
    ['Messy leads: names with extra spaces', '=SUMPRODUCT(--(LEN(Leads!B2:B151)<>LEN(TRIM(Leads!B2:B151))))'],
    ['NPS score', '=(COUNTIFS(NPS!E:E,">=9")-COUNTIFS(NPS!E:E,"<=6"))/(COUNTA(NPS!E:E)-1)'],
    ['A date, shown properly', '=TEXT(EOMONTH(TODAY(),0),"dd-mmm-yyyy")']
  ];

  function insertAtCursor(ta, text) {
    if (!ta) return;
    var s = ta.selectionStart, e = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
    ta.selectionStart = ta.selectionEnd = s + text.length;
    ta.focus();
  }

  function buildSheetPane() {
    var host = $('#schema-list'); if (!host || host.dataset.done) return;
    host.dataset.done = '1';
    var wb = ensureWorkbook();
    wb.sheets.forEach(function (s) {
      var d = document.createElement('details');
      var sum = document.createElement('summary');
      sum.appendChild(document.createTextNode(s.name));
      var cnt = document.createElement('span'); cnt.className = 'cnt'; cnt.textContent = s.rows.length.toLocaleString('en-IN'); sum.appendChild(cnt);
      d.appendChild(sum);
      var box = document.createElement('div'); box.className = 'schema-cols';
      var p = document.createElement('p'); p.textContent = s.desc; box.appendChild(p);
      s.cols.forEach(function (c, i) {
        var row = document.createElement('div'); row.className = 'schema-col';
        var letter = document.createElement('b'); letter.className = 'letter'; letter.textContent = XL.numToCol(i + 1);
        var b = document.createElement('b'); b.textContent = c.name; b.title = (c.doc || '') + ' [' + c.type + '] — click to insert ' + s.name + '!' + XL.numToCol(i + 1) + ':' + XL.numToCol(i + 1);
        b.addEventListener('click', function () { insertAtCursor($('#lab-editor'), s.name + '!' + XL.numToCol(i + 1) + ':' + XL.numToCol(i + 1)); });
        var sp = document.createElement('span'); sp.textContent = c.type;
        row.appendChild(letter); row.appendChild(b); row.appendChild(sp);
        box.appendChild(row);
      });
      d.appendChild(box); host.appendChild(d);
    });
  }

  function buildSheetViewer() {
    var pane = $('#sheet-pane'); if (!pane || pane.dataset.done) return;
    pane.dataset.done = '1';
    var wb = ensureWorkbook();
    var tabs = document.createElement('div'); tabs.className = 'sheet-tabs'; tabs.setAttribute('role', 'tablist');
    var desc = document.createElement('div'); desc.className = 'sheet-desc';
    var scroll = document.createElement('div'); scroll.className = 'sheet-scroll';
    var foot = document.createElement('div'); foot.className = 'sheet-foot';
    var PREVIEW = 150;
    function show(s) {
      $$('.sheet-tab', tabs).forEach(function (t) { t.setAttribute('aria-selected', t.dataset.name === s.name ? 'true' : 'false'); });
      desc.textContent = s.desc;
      scroll.innerHTML = '';
      var t = document.createElement('table'); t.className = 'grid';
      var thead = document.createElement('thead'), tr1 = document.createElement('tr');
      var c0 = document.createElement('th'); c0.className = 'rowno'; c0.textContent = ''; tr1.appendChild(c0);
      s.cols.forEach(function (c, i) { var th = document.createElement('th'); th.className = 'colhead'; th.innerHTML = XL.numToCol(i + 1) + '<small>' + esc(c.name) + '</small>'; tr1.appendChild(th); });
      thead.appendChild(tr1); t.appendChild(thead);
      var tb = document.createElement('tbody');
      var hr = document.createElement('tr'); var h0 = document.createElement('td'); h0.className = 'rowno'; h0.textContent = '1'; hr.appendChild(h0);
      s.cols.forEach(function (c) { var td = document.createElement('td'); td.textContent = c.name; td.style.fontWeight = '600'; hr.appendChild(td); });
      tb.appendChild(hr);
      s.rows.slice(0, PREVIEW).forEach(function (row, ri) {
        var tr = document.createElement('tr');
        var td0 = document.createElement('td'); td0.className = 'rowno'; td0.textContent = String(ri + 2); tr.appendChild(td0);
        row.forEach(function (v, ci) {
          var td = document.createElement('td'); var type = s.cols[ci].type;
          if (v === null || v === undefined || v === '') { td.className = 'nul'; td.textContent = ''; }
          else if (type === 'date') { td.className = 'date'; td.textContent = XL.display(v, 'date'); }
          else if (typeof v === 'number') { td.className = 'num'; td.textContent = XL.general(v); }
          else if (typeof v === 'boolean') { td.textContent = v ? 'TRUE' : 'FALSE'; }
          else td.textContent = String(v);
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      t.appendChild(tb); scroll.appendChild(t);
      foot.textContent = s.rows.length > PREVIEW ? 'Showing rows 1–' + (PREVIEW + 1) + ' of ' + (s.rows.length + 1) + '. Formulas see every row.' : 'All ' + (s.rows.length + 1) + ' rows shown.';
    }
    wb.sheets.forEach(function (s, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'sheet-tab'; b.setAttribute('role', 'tab'); b.dataset.name = s.name; b.textContent = s.name;
      b.addEventListener('click', function () { show(s); });
      tabs.appendChild(b);
      if (i === 0) setTimeout(function () { show(s); }, 0);
    });
    pane.appendChild(tabs); pane.appendChild(desc); pane.appendChild(scroll); pane.appendChild(foot);
  }

  function buildFnList() {
    var host = $('#fn-list'); if (!host || host.dataset.done) return;
    host.dataset.done = '1';
    XL.functions().filter(function (f) { return f !== 'GROUPBY'; }).forEach(function (f) {
      var c = document.createElement('code'); c.textContent = f; c.title = 'Insert ' + f + '(';
      c.addEventListener('click', function () { insertAtCursor($('#lab-editor'), f + '('); });
      host.appendChild(c);
    });
  }

  function setupLab() {
    var ta = $('#lab-editor');
    if (!ta || ta.dataset.done) return;
    ta.dataset.done = '1';
    var sel = $('#lab-samples');
    LAB_SAMPLES.forEach(function (s, i) { var o = document.createElement('option'); o.value = String(i); o.textContent = s[0]; sel.appendChild(o); });
    sel.addEventListener('change', function () { if (sel.value === '') return; ta.value = LAB_SAMPLES[+sel.value][1]; sel.value = ''; ta.focus(); runLab(); });
    ta.value = load('lab.formula', LAB_SAMPLES[0][1]);
    function runLab() {
      var q = ta.value.trim(), out = $('#lab-result');
      if (!q) { renderResult(out, { type: 'error', message: 'Type a formula first.' }); return; }
      save('lab.formula', ta.value);
      renderResult(out, run(q));
    }
    $('#lab-run').addEventListener('click', runLab);
    $('#lab-clear').addEventListener('click', function () { ta.value = '='; ta.focus(); save('lab.formula', '='); });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runLab(); }
      if (e.key === 'Tab') { e.preventDefault(); var s = ta.selectionStart, t2 = ta.selectionEnd; ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(t2); ta.selectionStart = ta.selectionEnd = s + 2; }
    });
    ta.addEventListener('blur', function () { save('lab.formula', ta.value); });
    buildSheetPane(); buildSheetViewer(); buildFnList();
    runLab();
  }

  function openInLab(formula) {
    go('lab');
    setTimeout(function () {
      var ta = $('#lab-editor'); if (!ta) return;
      ta.value = formula; save('lab.formula', formula);
      $('#lab-run').click();
      ta.scrollIntoView({ block: 'center' });
    }, 40);
  }

  /* ---------------- navigation rail ---------------- */
  function buildRail() {
    var nav = $('#nav');
    NAV.forEach(function (g) {
      var wrap = document.createElement('div'); wrap.className = 'nav-group';
      var lab = document.createElement('div'); lab.className = 'nav-label'; lab.textContent = g.label; wrap.appendChild(lab);
      g.items.forEach(function (it) {
        var a = document.createElement('a'); a.className = 'nav-a'; a.href = '#/' + it.id; a.dataset.id = it.id;
        var num = document.createElement('span'); num.className = 'nav-num'; num.textContent = it.num || '·';
        var txt = document.createElement('span'); txt.className = 'nav-txt'; txt.textContent = it.title;
        var tick = document.createElement('span'); tick.className = 'nav-tick'; tick.innerHTML = I.tick;
        a.appendChild(num); a.appendChild(txt); a.appendChild(tick); wrap.appendChild(a);
      });
      nav.appendChild(wrap);
    });
    refreshProgress();
  }
  function refreshProgress() {
    var done = MODULES.filter(function (m) { return progress[m.id]; }).length;
    $('#pcount').textContent = done + ' / ' + MODULES.length;
    $('#pbar').style.width = Math.round(done / MODULES.length * 100) + '%';
    $$('.nav-a').forEach(function (a) { a.classList.toggle('done', !!progress[a.dataset.id]); });
  }

  /* ---------------- page furniture ---------------- */
  function addFurniture(page, item) {
    if (page.dataset.furniture) return;
    page.dataset.furniture = '1';
    var idx = ORDER.indexOf(item);
    if (item.mod) {
      var bar = document.createElement('div'); bar.className = 'donebar';
      var p = document.createElement('p');
      var btn = document.createElement('button'); btn.className = 'btn'; btn.type = 'button';
      function paint() {
        var done = !!progress[item.id];
        bar.classList.toggle('is-done', done);
        p.textContent = done ? 'Module ' + item.num + ' marked complete.' : 'Finished this module? Mark it complete to track where you are.';
        btn.innerHTML = done ? '<span>Mark as not done</span>' : I.tick + '<span>Mark complete</span>';
      }
      btn.addEventListener('click', function () { if (progress[item.id]) delete progress[item.id]; else progress[item.id] = true; save('progress', progress); paint(); refreshProgress(); });
      paint(); bar.appendChild(p); bar.appendChild(btn); page.appendChild(bar);
    }
    var prev = idx > 0 ? ORDER[idx - 1] : null, next = idx >= 0 && idx < ORDER.length - 1 ? ORDER[idx + 1] : null;
    if (prev || next) {
      var nav = document.createElement('nav'); nav.className = 'pagenav'; nav.setAttribute('aria-label', 'Module navigation');
      if (prev) { var a1 = document.createElement('a'); a1.className = 'prev'; a1.href = '#/' + prev.id; a1.innerHTML = '<span class="dir">Previous</span>'; var t1 = document.createElement('span'); t1.className = 't'; t1.textContent = prev.title; a1.appendChild(t1); nav.appendChild(a1); }
      if (next) { var a2 = document.createElement('a'); a2.className = 'next'; a2.href = '#/' + next.id; a2.innerHTML = '<span class="dir">Next</span>'; var t2 = document.createElement('span'); t2.className = 't'; t2.textContent = next.title; a2.appendChild(t2); nav.appendChild(a2); }
      page.appendChild(nav);
    }
  }

  /* ---------------- router ---------------- */
  var current = null, currentId = 'home';
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '');
    if (!h) return { id: 'home', anchor: '' };
    var parts = h.split('#');
    var id = parts[0].replace(/\/$/, '');
    if (BY_ID[id]) return { id: id, anchor: parts[1] || '' };
    // a bare "#some-section" written inside a page: stay on the current page and scroll
    if (document.getElementById(id)) return { id: currentId, anchor: id };
    return { id: 'home', anchor: '' };
  }
  function go(id, anchor) { location.hash = '#/' + id + (anchor ? '#' + anchor : ''); }
  function route() {
    var r = parseHash();
    var item = BY_ID[r.id];
    var page = document.getElementById('page-' + r.id);
    if (!page) { item = BY_ID.home; page = document.getElementById('page-home'); r.id = 'home'; }
    if (current && current !== page) current.hidden = true;
    page.hidden = false; current = page; currentId = r.id;

    enhanceDiagrams(page); enhanceXlBlocks(page); enhanceExercises(page); enhanceQuiz(page); addFurniture(page, item);
    if (r.id === 'lab') setupLab();

    $$('.nav-a').forEach(function (a) { if (a.dataset.id === r.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var active = $('.nav-a[aria-current="page"]');
    if (active && active.scrollIntoView) {
      var railBox = $('#nav').getBoundingClientRect(), aBox = active.getBoundingClientRect();
      if (aBox.top < railBox.top || aBox.bottom > railBox.bottom) active.scrollIntoView({ block: 'center' });
    }
    document.title = item.title === 'Start here' ? SITE : item.title + ' · ' + SITE;
    closeRail();
    if (r.anchor) { var target = document.getElementById(r.anchor); if (target) { target.scrollIntoView({ behavior: 'auto', block: 'start' }); return; } }
    window.scrollTo(0, 0);
  }

  /* ---------------- search ---------------- */
  var index = null;
  function buildIndex() {
    index = [];
    ORDER.forEach(function (item) {
      var page = document.getElementById('page-' + item.id); if (!page) return;
      var heading = item.title, anchor = '';
      var walk = function (node) {
        Array.prototype.forEach.call(node.children, function (el) {
          var tag = el.tagName;
          if (tag === 'H1' || tag === 'H2' || tag === 'H3') { heading = el.textContent.trim(); var sec = el.closest('section'); anchor = sec && sec.id ? sec.id : ''; index.push({ page: item, heading: heading, anchor: anchor, text: '' }); }
          else if (tag === 'P' || tag === 'LI' || tag === 'DD' || tag === 'DT' || tag === 'TD' || tag === 'TH' || tag === 'FIGCAPTION') { var t = el.textContent.trim(); if (t && index.length) index[index.length - 1].text += ' ' + t; }
          else if (tag === 'PRE' || tag === 'SVG' || tag === 'STYLE' || tag === 'SCRIPT' || tag === 'TEXTAREA') return;
          else if (el.children.length) walk(el);
        });
      };
      index.push({ page: item, heading: item.title, anchor: '', text: '' });
      walk(page);
    });
    index = index.filter(function (e) { return e.heading; });
  }
  function search(q) {
    if (!index) buildIndex();
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    var out = [];
    index.forEach(function (e) {
      var h = e.heading.toLowerCase(), t = e.text.toLowerCase(), score = 0;
      for (var i = 0; i < terms.length; i++) {
        var term = terms[i];
        if (h.indexOf(term) >= 0) score += h.indexOf(term) === 0 ? 14 : 9;
        else if (t.indexOf(term) >= 0) score += 3;
        else if (e.page.title.toLowerCase().indexOf(term) >= 0) score += 2;
        else return;
      }
      out.push({ e: e, score: score });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, 24).map(function (x) { return x.e; });
  }
  function snippet(text, terms) {
    if (!text) return '';
    var low = text.toLowerCase(), at = -1;
    for (var i = 0; i < terms.length; i++) { at = low.indexOf(terms[i]); if (at >= 0) break; }
    var start = Math.max(0, at - 60);
    var s = (start > 0 ? '…' : '') + text.slice(start, start + 190).trim() + (text.length > start + 190 ? '…' : '');
    var frag = document.createDocumentFragment();
    var re = new RegExp('(' + terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'ig');
    var last = 0, m;
    while ((m = re.exec(s))) { frag.appendChild(document.createTextNode(s.slice(last, m.index))); var mk = document.createElement('mark'); mk.textContent = m[0]; frag.appendChild(mk); last = m.index + m[0].length; }
    frag.appendChild(document.createTextNode(s.slice(last)));
    return frag;
  }
  function setupSearch() {
    var overlay = $('#search'), input = $('#search-input'), list = $('#search-results');
    var sel = -1, rows = [];
    var HINT = '<div class="search-hint">Search every module, formula, exercise and capstone on this site.</div>';
    function open() { overlay.hidden = false; input.value = ''; list.innerHTML = HINT; sel = -1; rows = []; setTimeout(function () { input.focus(); }, 10); }
    function close() { overlay.hidden = true; }
    function render() {
      var q = input.value.trim(); list.innerHTML = '';
      if (!q) { list.innerHTML = HINT; rows = []; return; }
      var res = search(q), terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!res.length) { list.innerHTML = '<div class="search-empty">Nothing matched “' + esc(q) + '”.</div>'; rows = []; return; }
      rows = res.map(function (e) {
        var a = document.createElement('a'); a.className = 'sr'; a.href = '#/' + e.page.id + (e.anchor ? '#' + e.anchor : '');
        var top = document.createElement('div'); top.className = 'sr-top';
        var ti = document.createElement('span'); ti.className = 'sr-title'; ti.textContent = e.heading;
        var pg = document.createElement('span'); pg.className = 'sr-page'; pg.textContent = e.page.num ? 'Module ' + e.page.num : e.page.title;
        top.appendChild(ti); top.appendChild(pg); a.appendChild(top);
        if (e.text) { var sn = document.createElement('div'); sn.className = 'sr-snip'; sn.appendChild(snippet(e.text, terms)); a.appendChild(sn); }
        a.addEventListener('click', close); list.appendChild(a); return a;
      });
      sel = 0; paintSel();
    }
    function paintSel() { rows.forEach(function (r, i) { r.classList.toggle('sel', i === sel); }); if (rows[sel] && rows[sel].scrollIntoView) rows[sel].scrollIntoView({ block: 'nearest' }); }
    input.addEventListener('input', render);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (rows.length) { sel = (sel + 1) % rows.length; paintSel(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (rows.length) { sel = (sel - 1 + rows.length) % rows.length; paintSel(); } }
      else if (e.key === 'Enter') { if (rows[sel]) { e.preventDefault(); rows[sel].click(); } }
      else if (e.key === 'Escape') close();
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    $$('[data-search-open]').forEach(function (b) { b.addEventListener('click', open); });
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); overlay.hidden ? open() : close(); }
      else if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); open(); }
      else if (e.key === 'Escape' && !overlay.hidden) close();
    });
  }

  /* ---------------- theme ---------------- */
  function setupTheme() {
    var stored = load('theme', '');
    if (stored === 'dark' || stored === 'light') document.documentElement.setAttribute('data-theme', stored);
    function isDark() { var mode = document.documentElement.getAttribute('data-theme'); return mode === 'dark' || (!mode && window.matchMedia('(prefers-color-scheme: dark)').matches); }
    function paint() { var dark = isDark(); $$('[data-theme-toggle]').forEach(function (b) { b.innerHTML = dark ? I.sun : I.moon; b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); b.title = dark ? 'Light theme' : 'Dark theme'; }); }
    $$('[data-theme-toggle]').forEach(function (b) { b.addEventListener('click', function () { var next = isDark() ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', next); save('theme', next); paint(); }); });
    paint();
  }

  /* ---------------- mobile rail ---------------- */
  function openRail() { $('#rail').classList.add('open'); $('#scrim').hidden = false; }
  function closeRail() { $('#rail').classList.remove('open'); $('#scrim').hidden = true; }

  /* ---------------- boot ---------------- */
  function init() {
    buildRail(); setupSearch(); setupTheme();
    $('#menu-btn').addEventListener('click', openRail);
    $('#scrim').addEventListener('click', closeRail);
    var skip = document.querySelector('.skip-link');
    if (skip) skip.addEventListener('click', function (e) { e.preventDefault(); var main = document.getElementById('content'); if (main) { main.setAttribute('tabindex', '-1'); main.focus(); main.scrollIntoView(); } });
    window.addEventListener('hashchange', route);
    route();
    var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 800); };
    idle(function () { ensureWorkbook(); if (!index) buildIndex(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.M365MGR = { go: go, openInLab: openInLab, run: run };
})();
