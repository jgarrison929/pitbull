// Preload for loadSeedDrillItems (drill.mjs): lets seed/history.ts run with no database.
// `run` from @/server/assistant/actions is replaced by a recorder, and "server-only" by an empty module,
// so seedActionHistory's typed actions (CO approvals that add leaves, the Harbor estimate import) are
// captured in order instead of executed. Nothing else is stubbed.
const Module = require("node:module");
const path = require("node:path");
const runStub = path.join(__dirname, "run-recorder.cjs");
const empty = path.join(__dirname, "empty.cjs");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return empty;
  if (/(^|[\\/])server[\\/]assistant[\\/]actions(\.ts)?$/.test(request)) return runStub;
  return resolve.call(this, request, ...rest);
};
