"use client";

function escapeCSV(val: unknown): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCSV(headers: string[], rows: Record<string, unknown>[], keys: string[]): string {
  const headerLine = headers.map(escapeCSV).join(",");
  const dataLines = rows.map((row) =>
    keys.map((k) => escapeCSV(row[k])).join(",")
  );
  return [headerLine, ...dataLines].join("\r\n");
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadXLSX(
  headers: string[],
  rows: Record<string, unknown>[],
  keys: string[],
  filename: string
) {
  const XLSX = await import("xlsx");
  const wsData = [headers, ...rows.map((row) => keys.map((k) => row[k] ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, filename);
}
