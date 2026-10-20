/** @type {import('next').NextConfig} */
const nextConfig = {
  // A check build can run beside the dev server: NEXT_DIST_DIR=.next-check npm run build
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
  // The dev server watches code only. `npm run dev:local` rewrites .local/
  // (the emulator data) every 5 minutes; on Windows watching that churn
  // stopped the watcher, and edits no longer reloaded.
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.local/**", "**/.next*/**", "**/firebase-export-*/**", "**/android/**", "**/functions/**", "**/*.log"],
      };
    }
    return config;
  },
};

export default nextConfig;