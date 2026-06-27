import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

// Security headers for the marketing site. It serves only its own assets and links
// out to the app, so the policy can be tight. 'unsafe-inline' is kept for script/style
// because Next injects inline hydration scripts and the JSON-LD block, and the page has
// no auth or user input to protect — tighten to nonces later if desired.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://app.brainqueue.app",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lint is run separately (npm run lint); don't fail production builds on it.
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
  // The parent BrainQueue app has its own lockfile; pin tracing to this app so
  // Next doesn't infer the monorepo root.
  outputFileTracingRoot: root,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
