"use client";

interface MetisContextBarProps {
  filters?: Record<string, unknown>;
  activeTab?: string;
}

export function MetisContextBar({ filters, activeTab }: MetisContextBarProps) {
  if (!filters) return null;

  const activeFilters: string[] = [];

  // Tab
  if (activeTab && activeTab !== "summary") {
    const tabLabels: Record<string, string> = {
      sku: "SKU Chart",
      detail: "Detail (Kode)",
      "detail-size": "Detail Size",
    };
    activeFilters.push(tabLabels[activeTab] || activeTab);
  }

  // Date range
  const from = filters.from as string | undefined;
  const to = filters.to as string | undefined;
  if (from && to) {
    activeFilters.push(`${from} → ${to}`);
  }

  // Other filters
  const filterKeys = ["branch", "store", "entity", "gender", "series", "color", "tier", "tipe", "version"];
  for (const key of filterKeys) {
    const val = filters[key];
    if (val && Array.isArray(val) && val.length > 0) {
      activeFilters.push(`${key}: ${val.join(", ")}`);
    } else if (val && typeof val === "string" && val.length > 0) {
      activeFilters.push(`${key}: ${val}`);
    }
  }

  // Search
  const q = filters.q as string | undefined;
  if (q) {
    activeFilters.push(`search: "${q}"`);
  }

  if (activeFilters.length === 0) return null;

  return (
    <div className="px-3 py-2 border-b border-border bg-muted/30">
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-muted-foreground font-medium shrink-0">Viewing:</span>
        {activeFilters.map((f, i) => (
          <span
            key={i}
            className="text-[10px] bg-[#002A3A]/8 text-[#002A3A] px-1.5 py-0.5 rounded font-medium"
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}
