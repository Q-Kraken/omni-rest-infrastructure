import type { ReactNode } from "react";
export function CtaGroup({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return <section className={className} aria-label="Restaurant actions">{children}</section>;
}
