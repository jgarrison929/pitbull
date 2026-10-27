import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const testHooksImportMessage =
  "Do not import db/test-hooks from production code — only *.test.ts may use query-count / latency wraps. Import @/db instead.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Keep test-only DB instrumentation out of production modules.
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/db/test-hooks",
              message: testHooksImportMessage,
            },
          ],
          patterns: [
            {
              group: ["**/test-hooks", "**/test-hooks.*"],
              message: testHooksImportMessage,
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
