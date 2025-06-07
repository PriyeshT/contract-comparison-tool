import webpack from 'webpack';

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
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^cloudflare:sockets$/
      })
    );
    return config;
  }
}

export default nextConfig

export const runtime = 'nodejs'
