import { beforeEach, describe, expect, it, vi } from "vitest";
import { ordinaryRestaurant } from "@/test/fixtures";
const mocks = vi.hoisted(() => ({ readRestaurant: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "menu.localhost:3000" }) }));
vi.mock("./public-data", () => mocks);
import { publicPageMetadata } from "./seo";

describe("public metadata", () => {
  beforeEach(() => mocks.readRestaurant.mockReset().mockResolvedValue(ordinaryRestaurant));
  it("maps restaurant metadata and the largest photo to absolute Open Graph URLs", async () => {
    const metadata = await publicPageMetadata("/", { title: ordinaryRestaurant.name, description: ordinaryRestaurant.shortDescription });
    expect(metadata.alternates?.canonical).toBe("http://menu.localhost:3000/");
    expect(metadata.openGraph).toMatchObject({ title: ordinaryRestaurant.name, url: "http://menu.localhost:3000/", images: [{ url: "http://menu.localhost:3000/media/restaurant.webp", width: 1200, height: 800 }] });
  });
  it("keeps a safe fallback without emitting a canonical for an unresolved host", async () => {
    mocks.readRestaurant.mockResolvedValue(null);
    const metadata = await publicPageMetadata("/", { title: "Omni REST" });
    expect(metadata.title).toBe("Omni REST");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toBeUndefined();
  });
});
