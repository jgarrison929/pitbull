"use strict";

/**
 * TypeScript 7.0 ships a native `tsc` and no JS compiler API. typescript-eslint
 * still imports `typescript` (TS 6 API). Remap that require for this process only
 * so `npm run lint` can use ESLint 10 + eslint-config-next while the app depends
 * on typescript@7.
 */
const Module = require("module");
const originalLoad = Module._load;
Module._load = function loadTypescript6(request, parent, isMain) {
  if (request === "typescript") {
    request = "@typescript/typescript6";
  }
  return originalLoad.call(this, request, parent, isMain);
};

const path = require("path");
const eslintBin = path.join(path.dirname(require.resolve("eslint/package.json")), "bin", "eslint.js");
process.argv[1] = eslintBin;
require(eslintBin);
