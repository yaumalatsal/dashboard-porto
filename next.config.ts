import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    /**
     * Barrel files in these packages re-export hundreds of modules; without
     * this the bundler walks the whole barrel to find the handful of icons and
     * helpers actually used. `lucide-react` is the big one — the console and
     * the nav between them import about a dozen icons out of ~1500.
     */
    optimizePackageImports: [
      "lucide-react",
      "@react-three/drei",
      "@react-three/fiber",
    ],
  },
  /** `node:sqlite` is a runtime built-in; it must never be bundled or traced. */
  serverExternalPackages: ["node:sqlite"],
};

export default nextConfig;
