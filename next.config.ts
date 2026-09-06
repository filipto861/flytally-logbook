import type { NextConfig } from "next";

const securityHeaders=[
  {key:"Strict-Transport-Security",value:"max-age=31536000; includeSubDomains"},
  {key:"X-Content-Type-Options",value:"nosniff"},
  {key:"X-Frame-Options",value:"DENY"},
  {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
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
