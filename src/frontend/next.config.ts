import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

// A short content hash per design stylesheet, inlined into `designStylesheets.ts` as a `?v=` query.
// The stylesheets are cached for a year as immutable (see `headers` below), so without it an edited
// stylesheet never reaches a browser that loaded the old one.
const designStylesheetDirectory = join(process.cwd(), "public", "design-previews", "styles");
const designStylesheetVersions = Object.fromEntries(
  readdirSync(designStylesheetDirectory)
    .filter((fileName) => fileName.endsWith(".css"))
    .map((fileName) => [
      fileName,
      createHash("sha256").update(readFileSync(join(designStylesheetDirectory, fileName))).digest("hex").slice(0, 12),
    ]),
);

const nextConfig: NextConfig = {
  env: {
    OMNI_REST_DESIGN_STYLESHEET_VERSIONS: JSON.stringify(designStylesheetVersions),
  },
  images: {
    // The hosts allowed to serve optimized media, configured rather than hardcoded so a deployment
    // names its own CDN. Each entry must be an exact hostname: a wildcard here would let any
    // subdomain an attacker controls be proxied through the optimizer under our origin.
    remotePatterns: (process.env.OMNI_REST_MEDIA_HOSTS ?? "")
      .split(",").map((host) => host.trim().toLowerCase()).filter(Boolean)
      .map((hostname) => {
        // Reject URL fragments, ports and wildcard patterns: the same exact-host contract as the API.
        if (!/^(?=.{1,253}$)[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(hostname)) {
          throw new Error("OMNI_REST_MEDIA_HOSTS must contain exact HTTPS hostnames.");
        }
        return { protocol: "https" as const, hostname };
      }),
    // AVIF first, WebP second, original last. Both are negotiated from the `Accept` header, so a
    // browser that supports neither still gets the stored rendition.
    formats: ["image/avif", "image/webp"],
    // The upload ladder tops out at 1600px on the long edge (ResponsiveImageVariants.Ladder is
    // [480, 960, 1600]), so the 2048 and 3840 rungs Next ships by default could only ever re-encode
    // the same source at a size no stored file can fill. Dropping them keeps the optimizer's cache
    // from holding several identical renditions of every hero image.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // 480 matches the smallest rung the backend stores, which is what a gallery tile and a dish card
    // actually need; the rest are the Next defaults, used for logos and other small marks.
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 480],
    // Uploaded media is addressed as `/media/uploads/{restaurantId}/{guid}.{ext}` — a fresh GUID per
    // rung per upload — so a URL's bytes never change and the optimizer's cache entry cannot go
    // stale. The path is also tenant-scoped, so the optimizer's URL-keyed cache cannot serve one
    // restaurant's image under another's host. Thirty days.
    minimumCacheTTL: 2_592_000,
  },
  async headers() {
    return [
      // The five design stylesheets are static files under `public/`, which Next serves with no
      // cache header at all, so every cold load re-fetched 12-16 KB the visitor already had. Pages
      // link each stylesheet with its content hash in the query (`designStylesheetVersions` above),
      // so an edited stylesheet gets a new URL and the bytes behind a given URL are immutable and
      // can be cached as such. `immutable` also stops the revalidation request a long `max-age`
      // alone would still allow on reload.
      {
        source: "/design-previews/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      // Defense in depth for every non-indexable surface (PR-17 Task 4). Per-page `robots` metadata
      // is the primary control, but config headers are evaluated before the filesystem routes, so
      // this keeps an admin page that ships without metadata from ever being indexable. Where a page
      // tag and this header disagree, Google applies the more restrictive rule, so this can only
      // tighten indexing, never loosen it.
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // A JSON response cannot carry a meta tag, so the header is the only available control.
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
      {
        source: "/admin/design-preview/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; frame-ancestors 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
