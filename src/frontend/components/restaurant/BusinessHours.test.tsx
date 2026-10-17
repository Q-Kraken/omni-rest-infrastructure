import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BusinessHours, prepareBusinessHours } from "./BusinessHours";

describe("business hours", () => {
  it("renders all days, split periods, semantic times and confirmed overnight periods", () => {
    const model = prepareBusinessHours([
      { dayOfWeek: 1, intervals: [{ opensAt: "09:00:00", closesAt: "14:00:00", closesNextDay: false }, { opensAt: "18:00", closesAt: "02:00", closesNextDay: true }] },
    ], "2026-10-12");
    const { container } = render(<BusinessHours model={model} />);
    expect(container.querySelectorAll("dt")).toHaveLength(7);
    expect(container.querySelectorAll("time")).toHaveLength(4);
    expect(container.querySelector('time[datetime="09:00"]')).toHaveTextContent("09:00");
    expect(container.querySelector('[aria-current="date"]')).toHaveTextContent("Monday");
    expect(container.querySelectorAll('[aria-current="date"]')).toHaveLength(1);
    expect(screen.getAllByText("Closed")).toHaveLength(6);
    expect(container).toHaveTextContent("18:00–02:00 next day");
  });

  it("uses the prepared restaurant-local date even when UTC has moved to Tuesday", () => {
    const utcTuesday = new Date("2026-10-13T02:00:00Z");
    expect(utcTuesday.getUTCDay()).toBe(2);
    expect(prepareBusinessHours([], "2026-10-12").find((day) => day.current)?.name).toBe("Monday");
  });
});
