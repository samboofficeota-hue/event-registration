import type { NextConfig } from "next";

import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // @vercel/og (OG画像生成) を使っていないため、巨大なWASMバンドルを除外して
  // Cloudflare Workers の 3 MiB サイズ制限に収める
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...config.resolve.alias,
        "@vercel/og": false,
      };
    }
    return config;
  },
};

export default nextConfig;
