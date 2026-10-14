import type { ReactNode } from "react";
export function Hero({ children, className, headingId }: Readonly<{ children: ReactNode; className?: string; headingId: string }>) {
  return <section className={className} aria-labelledby={headingId}>{children}</section>;
}
