import { withEnvlock } from "envlock-next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
};

export default withEnvlock(nextConfig);
