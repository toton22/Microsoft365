# Microsoft 365 for Managers — Basics to pro

A complete, self-contained course website for BBA / MBA (Business Analytics) students: Excel formulas, lookups, PivotTables, Power Query, dashboards, Word, PowerPoint, Outlook, Teams, Forms, Lists, Planner, Power Automate, Excel modelling and Copilot — with a live in-browser **Formula Lab**, 335 runnable formulas, 91 self-checking exercises, 38 hand-drawn diagrams, quizzes, 94 verified free video/article links and 12 capstone projects.

It is the sibling of [SQL for Managers](https://toton22.github.io/SQL/) and runs on the same fictional company, **Novamart**, with the same rows.

## Host it on GitHub Pages (5 minutes)

1. Create a new public repository on GitHub, e.g. `M365`.
2. Upload **everything in this folder** to the root of the repository (drag-and-drop on github.com works; keep the `files/` folder). Commit.
3. Repository **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder = `/ (root)`. Save.
4. Wait a minute. The site is live at `https://<your-username>.github.io/M365/`.
5. Deep links work with the hash router: `…/M365/#/mindmap`, `…/M365/#/m03-formulas`, `…/M365/#/capstones#cap-04`, `…/M365/#/lab`.

No build step, no dependencies, no server code. The `.nojekyll` file tells GitHub Pages to serve the folder as-is.

## What is in the folder

| Path | What it is |
|---|---|
| `index.html` | The whole course: 20 pages (home, map, routes, 14 modules, capstones, lab, cheat sheet) in one hash-routed file |
| `styles.css` | The "Blueprint" design system (light + dark, mobile-first), sibling of the SQL course's "Ledger & Ink" |
| `app.js` | Router, search (`/` or Ctrl+K), progress tracking, theme, formula runner, exercise checker, Formula Lab |
| `xl.js` | The Excel formula engine used by the Lab: ~170 functions with Excel 365 semantics (dynamic arrays, XLOOKUP, LET, SUMIFS with array criteria, TEXT formats, dates as serials) |
| `data.js` | The deterministic Novamart generator (same seed as the SQL course) and the fixed workbook layout the modules refer to |
| `files/novamart-m365.xlsx` | The full workbook (13 sheets as Excel Tables) for use in real Excel |
| `files/cap01…cap12-*` | Starter files for the twelve capstones (.xlsx, .csv, .docx, .pptx) |
| `tools/xl-cli.js` | Evaluate any formula against the workbook from a terminal: `node tools/xl-cli.js '=SUMIFS(Sales!P:P,Sales!G:G,"App")'` (needs Node ≥ 16). Handy for setting and marking assignments. |
| `favicon.svg` | Tab icon |

## Editing the course

Everything is plain HTML. Each page is an `<article class="page" id="page-…">` inside `index.html`; the site map lives at the top of `app.js` (`NAV`). To add a module, add an article and a `NAV` entry — the rail, progress meter, search index and prev/next links build themselves.

Formula blocks are `<pre class="xl"><code>=…</code></pre>`; the app adds Run / Lab / Copy buttons and evaluates them against the workbook. Add `data-norun` for reference-only syntax (structured references, M, DAX, VBA). Exercises whose solution is a runnable formula get an automatic "Write your answer / Check answer" box.

Escape `<`, `>` and `&` inside `<code>` as `&lt;`, `&gt;`, `&amp;`.

## Credits

Built by the DGU AI Cell at DBS Global University. Linked videos and articles are free public resources from Microsoft and independent trainers (Kevin Stratvert, Leila Gharani, ExcelIsFun, Chandoo, MyOnlineTrainingHub, Exceljet, GCFGlobal and others); each link was verified when the course was published. Novamart and everyone in it are fictional.
