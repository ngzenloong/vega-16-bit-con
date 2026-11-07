import type { NextConfig } from "next";
const staticExport = process.env.VEGA_STATIC_EXPORT === "1";
const config: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: process.cwd() },
  poweredByHeader: false,
  output: staticExport ? "export" : undefined,
};
export default config;
