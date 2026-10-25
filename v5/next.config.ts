import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle-probe test writes to a side dist so `npm test` does not clobber `.next`.
  ...(process.env.POSTHOG_BUNDLE_PROBE_DIST
    ? { distDir: process.env.POSTHOG_BUNDLE_PROBE_DIST }
    : {}),
  env: { BUILD_TIME: process.env.BUILD_TIME ?? new Date().toISOString() },
  cacheComponents: true,
  partialPrefetching: true,
  // Estimate CSVs post through a server action; MAX_CSV_CHARS (1.5M) leaves room for multipart overhead.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
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
