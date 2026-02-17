import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/reach-frequency-calculator",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
