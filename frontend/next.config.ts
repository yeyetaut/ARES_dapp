import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss: http://127.0.0.1:8545 http://localhost:8545 https://verify.walletconnect.org https://verify.walletconnect.com",
              "frame-src 'self' https://verify.walletconnect.org https://verify.walletconnect.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
