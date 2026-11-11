import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle-probe test writes to a side dist so `npm test` does not clobber `.next`.
  ...(process.env.POSTHOG_BUNDLE_PROBE_DIST
    ? { distDir: process.env.POSTHOG_BUNDLE_PROBE_DIST }
    : {}),
  env: { BUILD_TIME: process.env.BUILD_TIME ?? new Date().toISOString() },
  cacheComponents: true,
  partialPrefetching: true,
  // Estimate CSVs (1.5M) and schedule imports (10 MB XER/XML) post through server actions.
  // 11mb leaves multipart overhead above MAX_SCHEDULE_IMPORT_BYTES.
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
