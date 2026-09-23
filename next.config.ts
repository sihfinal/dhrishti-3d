import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // fully static export: the "API" is just the committed public/data store,
  // so the site deploys to any static host and runs offline
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
