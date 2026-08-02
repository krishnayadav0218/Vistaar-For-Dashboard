Vistaar Dashboard — Instant Dashboard Generator
================================================

A single self-contained index.html — no build step, no install. Open it in a
browser, or deploy the folder as-is (vercel.json included).

WHAT'S IN HERE
  index.html   The app (drag/drop a .xlsx/.csv/.json file to get a dashboard)
  vercel.json  Static hosting config
  tests/       Optional Node tests for the pure parsing/inference/analytics
               logic. Run: node tests/logic.test.js
               (npm install xlsx --no-save first to also cover extractRowsSmart)

NOTES ON THIS VERSION
  All file types (.xlsx/.csv/.json) are now parsed off the main thread in a
  Web Worker so the tab doesn't freeze on large files; it falls back to the
  main thread automatically if the browser can't create a worker.

  Trend charts show a linear-regression forecast (dashed line, 3 periods
  ahead, with a "Projected up/down N%" subtitle) plus a moving-average
  smoothing line alongside the actual data. The Analytical dashboard also
  gets a correlation-matrix heatmap across numeric columns (pink = negative
  correlation, cyan = positive, capped at 6 columns for readability).

  Session (last dashboard) is kept in sessionStorage so an accidental reload
  can be resumed — cleared automatically when the tab closes. Skipped for
  very large datasets (20k+ rows), since re-serializing that much data on
  every save would cost more than the resume feature is worth.
