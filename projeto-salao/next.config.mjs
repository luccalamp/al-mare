/** @type {import('next').NextConfig} */

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Anti-Clickjacking
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Legacy XSS protection (CSP já cobre browsers modernos)
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
  {
    // Strict CSP against XSS
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://vercel.live https://accounts.google.com https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "style-src-attr 'unsafe-inline'",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://ccrorpxyvxzzsoafwbsj.supabase.co",
      "connect-src 'self' https://ccrorpxyvxzzsoafwbsj.supabase.co wss://ccrorpxyvxzzsoafwbsj.supabase.co https://vercel.live https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://static.cloudflareinsights.com",
      "frame-src 'self' https://accounts.google.com https://vercel.live",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  swcMinify: true,
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  generateEtags: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ccrorpxyvxzzsoafwbsj.supabase.co",
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
