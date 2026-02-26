export function toNum(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export function formatRp(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("en-US")}`;
}

export function formatNum(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function formatDec(n: number, digits = 1): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
