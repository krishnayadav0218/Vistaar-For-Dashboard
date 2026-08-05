Vistaar Dashboard — Instant Dashboard Generator
================================================

A single self-contained index.html — no build step, no install. Open it in a
browser, or deploy the folder as-is (vercel.json included).

WHAT'S IN HERE
  index.html   The app (drag/drop a .xlsx/.csv/.json file to get a dashboard,
               or click "Try with sample data" to see it with no upload)
  vercel.json  Static hosting config
  tests/       Node tests for the pure parsing/inference/analytics logic.
               Run: node tests/logic.test.js
               (npm install xlsx --no-save first to also cover extractRowsSmart)

NOTES ON THIS VERSION
  All file types (.xlsx/.csv/.json) are parsed off the main thread in a Web
  Worker so the tab doesn't freeze on large files; falls back to the main
  thread automatically if the browser can't create a worker.

  If an uploaded workbook has more than one sheet, you now pick which one
  right on the upload screen (with row/column counts and the auto-detected
  sheet marked "Recommended") instead of it silently choosing one for you.

  The review screen (before the dashboard is built) now flags data-quality
  issues: exact-duplicate rows (with a one-click "Remove duplicates" button
  that preserves any column-type overrides you've already made), and columns
  with more than 5% missing data.

  Charts are clickable: click a bar or slice on any categorical chart to
  filter the whole dashboard to that value — click it again to clear. Works
  wherever the chart's category column also has a filter dropdown in the
  toolbar.

  Trend charts show a linear-regression forecast (dashed line, 3 periods
  ahead, with a "Projected up/down N%" subtitle) plus a moving-average
  smoothing line. The Analytical dashboard also gets a correlation-matrix
  heatmap across numeric columns.

  Session (last dashboard) is kept in sessionStorage so an accidental reload
  can be resumed — cleared automatically when the tab closes. Skipped for
  very large datasets (20k+ rows).
