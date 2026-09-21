import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Next 16.3 enables the CLI checker by default, but its detached Node 24
    // subprocess can finish without forwarding `tsc --showConfig` output.
    // Keep type-checking enabled through the stable TypeScript compiler API.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
