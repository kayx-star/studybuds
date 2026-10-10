import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 开发时允许用 127.0.0.1 访问（与 localhost 分开保存登录状态，便于同时测试两个账号）
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      // 通过 Cloudflare 临时隧道分享时，浏览器地址是 *.trycloudflare.com，需允许它调用 Server Actions
      allowedOrigins: ["*.trycloudflare.com"],
    },
  },
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
