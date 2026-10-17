import { describe, expect, it } from "vitest";
import { formatPhoneDisplay } from "./phone-display";

describe("phone display", () => {
  it("formats NANP without changing the canonical number", () => {
    expect(formatPhoneDisplay("+14313778457")).toBe("(431) 377-8457");
    expect(formatPhoneDisplay("+442079460123")).toBe("+442079460123");
    expect(formatPhoneDisplay("2045550123")).toBeNull();
  });
});
