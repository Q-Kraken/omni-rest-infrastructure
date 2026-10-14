import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserApiError } from "@/lib/browser-api";
import { LogoutButton } from "./LogoutButton";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/lib/browser-api", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/browser-api")>(), mutate: mocks.mutate }));

describe("sign out", () => {
  beforeEach(() => { mocks.mutate.mockReset(); mocks.replace.mockReset(); mocks.refresh.mockReset(); });
  it("logs out and returns to the login page", async () => {
    const user = userEvent.setup();
    mocks.mutate.mockResolvedValue(null);
    render(<LogoutButton />);
    await user.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(mocks.mutate).toHaveBeenCalledWith("/api/v1/auth/logout", "POST", {});
    expect(mocks.replace).toHaveBeenCalledWith("/admin/login");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("stays on the protected page when logout cannot be confirmed", async () => {
    const user = userEvent.setup();
    mocks.mutate.mockRejectedValue(new BrowserApiError(503, { code: "auth_unavailable" }));
    render(<LogoutButton />);
    await user.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be confirmed");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeEnabled();
  });
});
