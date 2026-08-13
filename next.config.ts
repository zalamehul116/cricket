import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['192.168.1.109', '192.168.1.109:3000', 'localhost:3000'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ik.imagekit.io',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
