import { websiteDesignIds, type WebsiteDesignId } from "@/lib/restaurant-contract";

/**
 * `next.config.ts` hashes every design stylesheet at build time and inlines the result here. The
 * stylesheets are served with a one-year `immutable` cache, so the hash in the query string is what
 * makes an edited stylesheet reach a browser that already holds the old one. Outside a Next build
 * (unit tests) the variable is absent and the plain path is used.
 */
const stylesheetVersions = parseStylesheetVersions(process.env.OMNI_REST_DESIGN_STYLESHEET_VERSIONS);

export const designStylesheetHrefs: Readonly<Record<WebsiteDesignId, string>> = {
  [websiteDesignIds.legacyCurrent]: stylesheetHref("legacy-current-v1.css"),
  [websiteDesignIds.quietElegance]: stylesheetHref("quiet-elegance-v1.css"),
  [websiteDesignIds.nightfall]: stylesheetHref("nightfall-v1.css"),
  [websiteDesignIds.broadsheet]: stylesheetHref("broadsheet-v1.css"),
  [websiteDesignIds.sunroom]: stylesheetHref("sunroom-v1.css"),
};

function stylesheetHref(fileName: string) {
  const version = stylesheetVersions[fileName];
  const path = `/design-previews/styles/${fileName}`;
  return version ? `${path}?v=${version}` : path;
}

function parseStylesheetVersions(raw: string | undefined): Readonly<Record<string, string>> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}
