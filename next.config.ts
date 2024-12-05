import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Enable if you're using experimental features
    // appDir: true,
  },
  images: {
    remotePatterns: [
      // Add any remote image patterns if needed
    ],
  },
};

export default nextConfig;
