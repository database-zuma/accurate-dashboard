export interface FilterConfig {
  dateFrom: string;
  dateTo: string;
  branches?: string[];
  stores?: string[];
  series?: string[];
  genders?: string[];
  tiers?: string[];
  payments?: string[];
}

export function parseFilters(params: URLSearchParams): FilterConfig {
  const now = new Date();
  const ago = new Date(now);
  ago.setDate(ago.getDate() - 30);
  return {
    dateFrom: params.get("from") || ago.toISOString().split("T")[0],
    dateTo: params.get("to") || now.toISOString().split("T")[0],
    branches: params.get("branch")?.split(",") || undefined,
    stores: params.get("store")?.split(",") || undefined,
    series: params.get("series")?.split(",") || undefined,
    genders: params.get("gender")?.split(",") || undefined,
    tiers: params.get("tier")?.split(",") || undefined,
    payments: params.get("payment")?.split(",") || undefined,
  };
}

export function buildWhere(
  f: FilterConfig,
  table: "daily" | "txn",
  startIdx = 1
): { clause: string; values: unknown[]; nextIdx: number } {
  const conds: string[] = [];
  const vals: unknown[] = [];
  let idx = startIdx;

  conds.push(`sale_date >= $${idx++}`);
  vals.push(f.dateFrom);
  conds.push(`sale_date <= $${idx++}`);
  vals.push(f.dateTo);

  if (f.branches) {
    conds.push(`branch = ANY($${idx++}::text[])`);
    vals.push(f.branches);
  }
  if (f.stores) {
    conds.push(`toko = ANY($${idx++}::text[])`);
    vals.push(f.stores);
  }
  if (f.payments) {
    conds.push(`payment_type = ANY($${idx++}::text[])`);
    vals.push(f.payments);
  }

  if (table === "daily") {
    if (f.series) {
      conds.push(`series = ANY($${idx++}::text[])`);
      vals.push(f.series);
    }
    if (f.genders) {
      conds.push(`gender = ANY($${idx++}::text[])`);
      vals.push(f.genders);
    }
    if (f.tiers) {
      conds.push(`tier = ANY($${idx++}::text[])`);
      vals.push(f.tiers);
    }
  }

  return {
    clause: conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "",
    values: vals,
    nextIdx: idx,
  };
}
