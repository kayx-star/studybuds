import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Allow 127.0.0.1 in dev (it keeps logins separate from localhost, handy for testing two accounts at once)
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
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
