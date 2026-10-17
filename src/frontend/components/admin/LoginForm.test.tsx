import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserApiError } from "@/lib/browser-api";
import { LoginForm } from "./LoginForm";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/lib/browser-api", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/browser-api")>(), mutate: mocks.mutate }));

describe("owner authentication controls", () => {
  beforeEach(() => { mocks.mutate.mockReset(); mocks.replace.mockReset(); mocks.refresh.mockReset(); });

  it("validates locally, toggles visibility, signs in, and passes a safe return path", async () => {
    const user = userEvent.setup();
    mocks.mutate.mockResolvedValue({ returnPath: "/admin/restaurant" });
    const { container } = render(<LoginForm returnPath="/admin/restaurant" />);
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email and password.");
    await user.type(screen.getByLabelText("Email"), "owner@example.test");
    await user.type(screen.getByLabelText("Password", { exact: true }), "secret-password");
    await user.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(mocks.mutate).toHaveBeenCalledWith("/api/v1/auth/login", "POST", expect.objectContaining({ email: "owner@example.test", returnPath: "/admin/restaurant" }));
    expect(mocks.replace).toHaveBeenCalledWith("/admin/restaurant");
    expect((await axe.run(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  it("clears the password and reports throttling without revealing account state", async () => {
    const user = userEvent.setup();
    mocks.mutate.mockRejectedValue(new BrowserApiError(429, { code: "rate_limited" }));
    render(<LoginForm returnPath="/admin" />);
    await user.type(screen.getByLabelText("Email"), "owner@example.test");
    await user.type(screen.getByLabelText("Password", { exact: true }), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Too many attempts");
    expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("");
  });


});
