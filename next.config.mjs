/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.externals.push({
      'webworker-threads': 'commonjs webworker-threads'
    });
    return config;
  }
}

export default nextConfig

export const runtime = 'nodejs'
