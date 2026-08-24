/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@abbyscaterers/database',
    '@abbyscaterers/types',
    '@abbyscaterers/validation',
  ],
};

module.exports = nextConfig;
