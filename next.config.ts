import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/reach-frequency-calculator",
  env: {
    NEXT_PUBLIC_BASE_PATH: "/reach-frequency-calculator",
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
