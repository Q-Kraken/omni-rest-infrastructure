export function formatPhoneDisplay(e164: string): string | null {
  if (!/^\+[1-9]\d{1,14}$/.test(e164)) return null;
  return /^\+1\d{10}$/.test(e164)
    ? `(${e164.slice(2, 5)}) ${e164.slice(5, 8)}-${e164.slice(8)}`
    : e164;
}
