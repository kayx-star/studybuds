import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 开发时允许用 127.0.0.1 访问（与 localhost 分开保存登录状态，便于同时测试两个账号）
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
