import type { NextConfig } from "next";
import { assertCommercialProductionBuildSafe } from "./lib/commercial-build-guard.ts";

assertCommercialProductionBuildSafe(process.env);

const contentSecurityPolicy=[
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV==="production"?"":" 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(process.env.NODE_ENV==="production"?["upgrade-insecure-requests"]:[]),
].join("; ");

const securityHeaders=[
  {key:"Strict-Transport-Security",value:"max-age=31536000; includeSubDomains"},
  {key:"X-Content-Type-Options",value:"nosniff"},
  {key:"X-Frame-Options",value:"DENY"},
  {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
  {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=(), payment=(), usb=()"},
  {key:"X-DNS-Prefetch-Control",value:"off"},
  {key:"Cross-Origin-Opener-Policy",value:"same-origin"},
  {key:"Cross-Origin-Resource-Policy",value:"same-origin"},
  {key:"Content-Security-Policy",value:contentSecurityPolicy},
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  outputFileTracingIncludes: { "/*": ["./data/airports.csv"] },
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  async headers(){
    return[
      {source:"/:path*",headers:securityHeaders},
      {source:"/sw.js",headers:[{key:"Cache-Control",value:"no-cache, no-store, must-revalidate"},{key:"Service-Worker-Allowed",value:"/"}]},
      {source:"/manifest.webmanifest",headers:[{key:"Cache-Control",value:"public, max-age=3600"}]},
    ];
  },
};

export default nextConfig;
