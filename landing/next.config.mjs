import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lint is run separately (npm run lint); don't fail production builds on it.
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
  // The parent BrainQueue app has its own lockfile; pin tracing to this app so
  // Next doesn't infer the monorepo root.
  outputFileTracingRoot: root,
};

export default nextConfig;
