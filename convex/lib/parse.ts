export function parseBrNumber(input: string): number {
  const s = (input || "").trim();
  if (!s) return 0;
  // Remove currency and spaces
  const cleaned = s
    .replace(/[Rr]\$\s*/g, "")
    .replace(/\s+/g, "")
    .replace(/\./g, "") // thousands
    .replace(/,/g, "."); // decimal
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

export function safeLower(input: string): string {
  return (input || "").toLowerCase();
}

export function nowMs(): number {
  return Date.now();
}
