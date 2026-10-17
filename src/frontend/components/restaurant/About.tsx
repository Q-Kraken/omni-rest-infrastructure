export function About({ description, className }: Readonly<{ description?: string | null; className?: string }>) {
  if (!description) return null;
  return <section aria-label="About the restaurant"><h2>About</h2><p className={className}>{description}</p></section>;
}
