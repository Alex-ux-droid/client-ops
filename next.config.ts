import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Сервер збирає нову версію в окрему папку (NEXT_DIST_DIR), поки стара працює, потім міняє місцями — без простою
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["better-sqlite3", "pdfkit"],
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "same-origin" },
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)" },
      ],
    }];
  },
};

export default nextConfig;
