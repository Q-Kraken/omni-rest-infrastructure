import type { ImageLoader } from "next/image";

/**
 * Restaurant uploads are served through this app's `/media` route, which forwards the visitor's `Host`
 * so the backend can check the file belongs to the restaurant on that host. The built-in image
 * optimizer fetches local images through a mocked request that carries no headers at all, so the route
 * sees no `Host`, answers 404, and the photo renders broken. Tenant media therefore never goes through
 * the optimizer: the browser requests it directly, on the restaurant's own host.
 */
export function isTenantMedia(src: string): boolean {
  return src.startsWith("/media/");
}

type Variant = Readonly<{ url: string; width: number }>;

/**
 * A loader that answers each `srcset` width with the narrowest stored rung that covers it, so a phone
 * still downloads the 480 px file rather than the 1600 px one now that the optimizer cannot resize.
 * Undefined, meaning "use the optimizer", when the image is not tenant media.
 */
export function tenantMediaLoader(variants: readonly Variant[]): ImageLoader | undefined {
  if (variants.length === 0 || !variants.every((variant) => isTenantMedia(variant.url))) return undefined;
  const ascending = [...variants].sort((left, right) => left.width - right.width);
  return ({ width }) => (ascending.find((variant) => variant.width >= width) ?? ascending[ascending.length - 1]).url;
}
