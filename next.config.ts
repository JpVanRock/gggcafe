import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Fonts and logo the practice-plan PDF reads from disk (src/lib/pdf).
  outputFileTracingIncludes: {
    "/dugout/**": ["./src/lib/pdf/**/*"],
  },
  // My Journal moved into Mental GP (user, 2026-11-12): old links still land on it
  async redirects() {
    return [{ source: "/players/:playerId/journal", destination: "/players/:playerId/mental/my-journal", permanent: true }];
  },
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
