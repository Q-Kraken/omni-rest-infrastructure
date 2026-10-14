import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ordinaryRestaurant } from "@/test/fixtures";
import { RestaurantMap } from "./RestaurantMap";

describe("restaurant map", () => {
  const address = { ...ordinaryRestaurant.address!, latitude: 49.8951, longitude: -97.1384 };
  it("loads a named, deferred map with the configured key and coordinates", () => {
    const { container } = render(<RestaurantMap address={address} apiKey="test-key" />);
    const iframe = container.querySelector("iframe")!;
    expect(iframe).toHaveAttribute("loading", "lazy");
    expect(iframe).toHaveAttribute("title", `Map of ${address.formatted}`);
    const url = new URL(iframe.src);
    expect(url.origin).toBe("https://www.google.com");
    expect(url.searchParams.get("q")).toBe("49.8951,-97.1384");
    expect(url.searchParams.get("key")).toBe("test-key");
  });
  it("omits the iframe when configuration or either coordinate is missing", () => {
    const { container, rerender } = render(<RestaurantMap address={address} />);
    expect(container.querySelector("iframe")).toBeNull();
    rerender(<RestaurantMap address={{ ...address, longitude: null }} apiKey="test-key" />);
    expect(container.querySelector("iframe")).toBeNull();
    rerender(<RestaurantMap address={null} apiKey="test-key" />);
    expect(container.querySelector("iframe")).toBeNull();
  });
});
