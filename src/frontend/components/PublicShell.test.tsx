import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ordinaryRestaurant } from "@/test/fixtures";
import { PublicShell } from "./PublicShell";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const imageProps = { ...props };
    Reflect.deleteProperty(imageProps, "sizes");
    return React.createElement("img", imageProps);
  },
}));

describe("PublicShell", () => {
  it("brands the header with the restaurant's published logo", () => {
    const { container } = render(
      <PublicShell restaurantName={ordinaryRestaurant.name} logo={ordinaryRestaurant.logo}>
        <main id="main-content" />
      </PublicShell>,
    );

    const logo = container.querySelector('img[src="/media/logo.webp"]');
    expect(logo).not.toBeNull();
    expect(logo).toHaveAttribute("alt", "");
    expect(screen.getByRole("link", { name: "Prairie Table home" })).toHaveAttribute("href", "/");
    expect(container.querySelector(".publicBrandMark")).toBeNull();
  });

  it("falls back to the restaurant's own initials, never a platform glyph", () => {
    const { container } = render(
      <PublicShell restaurantName="Prairie Table">
        <main id="main-content" />
      </PublicShell>,
    );

    expect(container.querySelector(".publicBrandMark")?.textContent).toBe("PT");
    expect(container.textContent).not.toContain("OR");
    expect(container.textContent).not.toMatch(/Omni/i);
  });

  it("shows no brand at all when the restaurant is unknown", () => {
    const { container } = render(
      <PublicShell>
        <main id="main-content" />
      </PublicShell>,
    );

    // The 404 and error states render before any restaurant is resolved. Naming one there would
    // advertise a brand that belongs to no restaurant on this host.
    expect(container.textContent).not.toMatch(/Omni/i);
    expect(container.querySelector(".publicBrandMark")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".publicFooter")?.textContent).toBe("");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });

  it("links home instead of back to the menu when already on the menu", () => {
    const { unmount } = render(
      <PublicShell restaurantName="Prairie Table">
        <main id="main-content" />
      </PublicShell>,
    );
    const navigation = () => screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(navigation()).getByRole("link", { name: "Menu" })).toHaveAttribute("href", "/menu");
    unmount();

    render(
      <PublicShell restaurantName="Prairie Table" onMenuPage>
        <main id="main-content" />
      </PublicShell>,
    );
    // A "Menu" link on the menu pointed at the page already open: clicking it only announced
    // "Loading menu…" and went nowhere.
    expect(within(navigation()).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(within(navigation()).queryByRole("link", { name: "Menu" })).toBeNull();
  });
});
