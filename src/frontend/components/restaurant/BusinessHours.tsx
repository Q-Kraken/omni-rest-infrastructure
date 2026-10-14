import { Fragment } from "react";
import type { HourInterval, RegularHoursDay } from "@/lib/restaurant-contract";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export type BusinessHoursModel = readonly { day: number; name: string; current: boolean; intervals: HourInterval[] }[];

export function prepareBusinessHours(hours: RegularHoursDay[], localDate?: string): BusinessHoursModel {
  // localDate is prepared on the server in the restaurant's time zone, never in the visitor's zone.
  const current = localDate ? new Date(`${localDate}T00:00:00Z`).getUTCDay() : null;
  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({
    day, name: days[day], current: day === current,
    intervals: hours.find((entry) => entry.dayOfWeek === day)?.intervals ?? [],
  }));
}

export function HourIntervals({ intervals }: Readonly<{ intervals: HourInterval[] }>) {
  if (intervals.length === 0) return <>Closed</>;
  return <>{intervals.map((period, index) => <Fragment key={index}>
    {index > 0 ? ", " : null}
    <time dateTime={period.opensAt.slice(0, 5)}>{period.opensAt.slice(0, 5)}</time>–<time dateTime={period.closesAt.slice(0, 5)}>{period.closesAt.slice(0, 5)}</time>
    {period.closesNextDay ? " next day" : null}
  </Fragment>)}</>;
}

export function BusinessHours({ model, className }: Readonly<{ model: BusinessHoursModel; className?: string }>) {
  return <dl className={className}>{model.map((day) => <div key={day.day}
    aria-current={day.current ? "date" : undefined}
    style={day.current ? { fontWeight: 700, borderInlineStart: "3px solid currentColor", paddingInlineStart: "0.5rem" } : undefined}
  ><dt>{day.name}</dt><dd><HourIntervals intervals={day.intervals} /></dd></div>)}</dl>;
}
