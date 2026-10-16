/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // `npm run dev:phone`: the dev server is opened from this machine's Wi-Fi address.
  ...(process.env.CC_LAN_HOST ? { allowedDevOrigins: [process.env.CC_LAN_HOST] } : {}),
};

export default nextConfig;