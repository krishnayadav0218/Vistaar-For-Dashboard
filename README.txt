Vistaar Dashboard — Instant Dashboard Generator
================================================

A single self-contained index.html — no build step, no install. Open it in a
browser, or deploy the folder as-is (vercel.json included).

WHAT'S IN HERE
  index.html   The app (drag/drop a .xlsx/.csv/.json file to get a dashboard)
  vercel.json  Static hosting config
  tests/       Optional Node tests for the pure parsing/inference logic
               Run: node tests/logic.test.js
               (npm install xlsx --no-save first to also cover extractRowsSmart)

NOTES ON THIS VERSION
  Large files (.xlsx/.csv) are parsed off the main thread in a Web Worker so
  the tab doesn't freeze; it falls back to the main thread automatically if
  the browser can't create a worker. JSON files still parse on the main
  thread (JSON.parse can't easily be moved off-thread) — fine for typical
  file sizes, but a very large JSON export can still cause a brief pause.

  Session (last dashboard) is kept in sessionStorage so an accidental reload
  can be resumed — cleared automatically when the tab closes.
