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
};

export default nextConfig;
