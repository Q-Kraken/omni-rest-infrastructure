import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProtectedAdminLayout from "./layout";

const { getSession, readAdminRestaurantResult, redirect } = vi.hoisted(() => ({
  getSession: vi.fn(), readAdminRestaurantResult: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-omni-admin-return-path": "/admin/menu" }) }));
vi.mock("next/navigation", () => ({ redirect, useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/server-api", () => ({ getSession, UNREACHABLE_API: { status: 0, data: null } }));
vi.mock("@/lib/admin-data", () => ({ readAdminRestaurantResult, readAdminRestaurant: vi.fn() }));
vi.mock("@/components/admin/AdminNavLink", () => ({ AdminNavLink: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

describe("domain-bound admin layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ status: 200, data: { memberships: [{ restaurantId: "logan" }] } });
    readAdminRestaurantResult.mockResolvedValue({ status: 200, data: { id: "logan", name: "Logan Corner" } });
  });

  it("denies a wrong-domain session without redirecting or exposing child content", async () => {
    getSession.mockResolvedValue({ status: 403, data: null });
    render(await ProtectedAdminLayout({ children: <p>Private editor</p> }));
    expect(screen.getByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
    expect(screen.queryByText("Private editor")).not.toBeInTheDocument();
    expect(readAdminRestaurantResult).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("denies access if restaurant authorization changes after the session check", async () => {
    readAdminRestaurantResult.mockResolvedValue({ status: 403, data: null });
    render(await ProtectedAdminLayout({ children: <p>Private editor</p> }));
    expect(screen.getByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(screen.queryByText("Private editor")).not.toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("refuses to render a restaurant outside the session membership", async () => {
    readAdminRestaurantResult.mockResolvedValue({ status: 200, data: { id: "juvian", name: "Juvian's Restaurant" } });
    render(await ProtectedAdminLayout({ children: <p>Private editor</p> }));
    expect(screen.getByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(screen.queryByText("Juvian's Restaurant")).not.toBeInTheDocument();
    expect(screen.queryByText("Private editor")).not.toBeInTheDocument();
  });

  it("renders the verified restaurant and retains deep-link login for signed-out users", async () => {
    const { unmount } = render(await ProtectedAdminLayout({ children: <p>Private editor</p> }));
    expect(screen.getByText("Logan Corner")).toBeInTheDocument();
    expect(screen.getByText("Private editor")).toBeInTheDocument();
    unmount();
    getSession.mockResolvedValue({ status: 401, data: null });
    await expect(ProtectedAdminLayout({ children: <p>Private editor</p> })).rejects.toThrow("redirect:/admin/login?returnPath=%2Fadmin%2Fmenu");
  });
});
