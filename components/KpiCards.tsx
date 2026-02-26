"use client";

interface KpiData {
  revenue: number;
  pairs: number;
  transactions: number;
  atu: number;
  asp: number;
  atv: number;
}

function fmt(n: number, type: "currency" | "int" | "decimal"): string {
  if (type === "currency") {
    if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}jt`;
    return "Rp " + Math.round(n).toLocaleString("en-US");
  }
  if (type === "decimal") {
    return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  return Math.round(n).toLocaleString("en-US");
}

const CARDS = [
  { label: "Revenue", key: "revenue" as const, type: "currency" as const },
  { label: "Pairs Sold", key: "pairs" as const, type: "int" as const },
  { label: "Transactions", key: "transactions" as const, type: "int" as const },
  { label: "ATU", key: "atu" as const, type: "decimal" as const, tooltip: "Avg Transaction Unit = Pairs / Transactions" },
  { label: "ASP", key: "asp" as const, type: "currency" as const, tooltip: "Avg Selling Price = Revenue / Pairs" },
  { label: "ATV", key: "atv" as const, type: "currency" as const, tooltip: "Avg Transaction Value = Revenue / Transactions" },
];

export default function KpiCards({ kpis, loading }: { kpis?: KpiData; loading?: boolean }) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {CARDS.map(({ label, key, type, tooltip }) => (
        <div
          key={key}
          title={tooltip}
          className="bg-card border border-border rounded-sm px-4 py-3 flex flex-col gap-1 border-l-2 border-l-[#00E273] shadow-sm"
        >
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">{label}</p>
          {loading ? (
            <div className="h-5 w-20 bg-muted animate-pulse rounded-sm" />
          ) : (
            <p className="text-sm font-bold text-foreground tabular-nums tracking-tight">
              {kpis ? fmt(kpis[key], type) : "—"}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
