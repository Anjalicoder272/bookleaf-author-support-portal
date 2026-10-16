import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev-only Next.js badge away from the sidebar's user card.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
