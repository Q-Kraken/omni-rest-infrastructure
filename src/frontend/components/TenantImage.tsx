"use client";

import Image, { type ImageProps } from "next/image";

import { tenantMediaLoader } from "@/lib/tenant-media";

type TenantImageProps = Omit<ImageProps, "loader" | "alt"> &
  Readonly<{ alt: string; variants: readonly Readonly<{ url: string; width: number }>[] }>;

/**
 * `next/image` with the tenant-media loader, for Server Components: a loader is a function, which a
 * Server Component cannot hand to the client `Image`, so the loader is built here from the variants.
 */
export function TenantImage({ variants, alt, ...props }: TenantImageProps) {
  return <Image {...props} alt={alt} loader={tenantMediaLoader(variants)} />;
}
