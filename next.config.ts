import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // Removed output: 'export' to allow dynamic rendering for dynamic routes
  // output: 'export', // Ensure this is active for static export
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
    unoptimized: true, // Recommended for Electron static exports
  },
};

export default nextConfig;
