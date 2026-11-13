import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Upload da logo (até 1 MB) passa por Server Action: o padrão do Next é 1 MB no total.
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Sistema interno: não aparece em buscadores, não abre dentro de outros sites e não vaza o
  // endereço (o link da proposta tem um código secreto) para sites de terceiros.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
