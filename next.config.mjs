/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.malfini.com",
        pathname: "/image/**",
      },
    ],
  },
  async redirects() {
    return [
      // The old WordPress site's order form lived here — keep its links and search
      // ranking working once the domain points at the webshop.
      { source: "/rendeles", destination: "/megrendelo-lap", permanent: true },
    ];
  },
};

export default nextConfig;
