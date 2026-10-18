/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // `npm run dev:phone`: the dev server is opened from this machine's Wi-Fi address.
  ...(process.env.CC_LAN_HOST ? { allowedDevOrigins: [process.env.CC_LAN_HOST] } : {}),
  // Old addresses (roadmap 4.7): chat moved to its own workspace (4.4), and the
  // feed page was only ever a placeholder. Links in old notifications and
  // bookmarks still land somewhere useful (the ?c= of a chat is kept).
  async redirects() {
    return [
      { source: "/chat", destination: "/messages", permanent: false },
      { source: "/branch-chat", destination: "/messages", permanent: false },
      { source: "/feeds", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;