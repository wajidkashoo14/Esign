import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "bcryptjs", "node-forge", "@signpdf/signpdf", "@signpdf/signer-p12", "@signpdf/placeholder-pdf-lib", "pdf-lib", "@pdf-lib/fontkit"],
  // PDF fonts are read from disk at runtime; make sure they ship with every server function.
  outputFileTracingIncludes: { "/**": ["./assets/fonts/**/*"] },
  async headers() {
    // The Content-Security-Policy (with per-request nonce) is set in src/middleware.ts.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default config;
