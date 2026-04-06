import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@chakra-ui/react"],
    turbopackUseSystemTlsCerts: true,
  },
};

export default nextConfig;