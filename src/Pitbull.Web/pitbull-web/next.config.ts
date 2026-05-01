import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || require("./package.json").version,
    NEXT_PUBLIC_COMMIT_HASH: process.env.NEXT_PUBLIC_COMMIT_HASH || "dev",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
