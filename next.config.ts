import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  outputFileTracingIncludes: { "/*": ["./data/airports.csv"] },
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
