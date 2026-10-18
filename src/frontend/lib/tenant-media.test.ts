import { describe, expect, it } from "vitest";

import { isTenantMedia, tenantMediaLoader } from "./tenant-media";

const upload = (name: string) => `/media/uploads/45581d41664847d2b244ce8eca39403b/${name}.jpg`;

describe("tenant media", () => {
  it("recognizes uploads served through the per-tenant /media route", () => {
    expect(isTenantMedia(upload("de0b4e5b6ab15623826f5cd275077159"))).toBe(true);
  });

  it("leaves CDN images and other local files to the optimizer", () => {
    expect(isTenantMedia("https://images.example.test/media/uploads/a.jpg")).toBe(false);
    expect(isTenantMedia("/design-previews/sunroom-v1.png")).toBe(false);
    expect(isTenantMedia("/public/media/logo.png")).toBe(false);
  });

  it("answers each requested width with the narrowest stored rung that covers it", () => {
    const loader = tenantMediaLoader([
      { url: upload("full"), width: 1195 },
      { url: upload("small"), width: 480 },
      { url: upload("medium"), width: 960 },
    ])!;
    expect(loader({ src: upload("full"), width: 384 })).toBe(upload("small"));
    expect(loader({ src: upload("full"), width: 480 })).toBe(upload("small"));
    expect(loader({ src: upload("full"), width: 750 })).toBe(upload("medium"));
    expect(loader({ src: upload("full"), width: 1080 })).toBe(upload("full"));
    expect(loader({ src: upload("full"), width: 1920 })).toBe(upload("full"));
  });

  it("keeps the optimizer for images that are not tenant media", () => {
    expect(tenantMediaLoader([{ url: "https://images.example.test/a.jpg", width: 640 }])).toBeUndefined();
    expect(tenantMediaLoader([])).toBeUndefined();
  });
});
