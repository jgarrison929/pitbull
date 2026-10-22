import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
