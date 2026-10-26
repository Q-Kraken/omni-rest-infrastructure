import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RestaurantPage from "./(protected)/restaurant/page";
import MenuPage from "./(protected)/menu/page";
import DishesPage from "./(protected)/menu/dishes/page";
import GalleryPage from "./(protected)/gallery/page";
import DesignPage from "./(protected)/design/page";
import PreviewPage from "./(protected)/restaurant/preview/page";
import QrCodePage from "./(protected)/qr-code/page";
import DesignHomePreview from "./design-preview/[designId]/home/page";
import DesignMenuPreview from "./design-preview/[designId]/menu/page";
import { GET as getPng } from "./(protected)/qr-code/qr.png/route";
import { GET as getSvg } from "./(protected)/qr-code/qr.svg/route";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: () => { throw new Error("Unexpected redirect"); },
  notFound: () => { throw new Error("Unexpected notFound"); },
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/server-api", () => {
  const denied = async () => ({ status: 403, data: null, problem: { code: "auth_forbidden" } });
  return {
    getAdminRestaurant: denied, getAdminMediaAssets: denied, getAdminMenu: denied,
    getAdminGallery: denied, getAdminPreview: denied, getAdminWebsiteDesignPreview: denied,
    UNREACHABLE_API: { status: 0, data: null },
  };
});
vi.mock("@/lib/admin-data", () => ({ readAdminRestaurant: vi.fn() }));
vi.mock("./(protected)/qr-code/qr-target", () => ({ readQrTarget: async () => ({ kind: "denied" }) }));

describe("admin pages preserve forbidden responses", () => {
  const pages = [
    ["restaurant", () => RestaurantPage()], ["menu", () => MenuPage()],
    ["dishes", () => DishesPage()], ["gallery", () => GalleryPage()],
    ["design", () => DesignPage()], ["preview", () => PreviewPage()],
    ["QR code", () => QrCodePage()],
    ["design home preview", () => DesignHomePreview({ params: Promise.resolve({ designId: "sunroom-v1" }) })],
    ["design menu preview", () => DesignMenuPreview({ params: Promise.resolve({ designId: "sunroom-v1" }) })],
  ] as const;

  it.each(pages)("shows access denied for %s without redirecting to login", async (_, page) => {
    render(await page());
    expect(screen.getByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign In" })).not.toBeInTheDocument();
  });

  it.each([["PNG", getPng], ["SVG", getSvg]] as const)("refuses the %s download with 403", async (_, download) => {
    const response = await download();
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("Access denied.");
  });
});
