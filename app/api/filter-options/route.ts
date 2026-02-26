import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function parseMulti(sp: URLSearchParams, key: string): string[] {
  const val = sp.get(key);
  if (!val) return [];
  return val.split(",").map((v) => v.trim()).filter(Boolean);
}

function buildWhereClause(
  sp: URLSearchParams,
  skipParam: string,
  vals: unknown[],
  startIdx: number
): { conds: string[]; nextIdx: number } {
  const conds: string[] = [];
  let i = startIdx;

  const from = sp.get("from");
  const to = sp.get("to");
  if (from) { conds.push(`d.sale_date >= $${i++}`); vals.push(from); }
  if (to)   { conds.push(`d.sale_date <= $${i++}`); vals.push(to); }

  for (const [param, col] of [
    ["branch", "d.branch"],
    ["store",  "d.toko"],
    ["gender", "d.gender"],
    ["series", "d.series"],
    ["color",  "d.color"],
    ["tier",   "d.tier"],
    ["tipe",   "d.tipe"],
    ["version", "d.version"],
    ["entity",  "d.source_entity"],
    ["customer", "d.customer"],
  ] as [string, string][]) {
    if (param === skipParam) continue;
    const fv = parseMulti(sp, param);
    if (fv.length === 0) continue;
    const phs = fv.map(() => `$${i++}`).join(", ");
    conds.push(`${col} IN (${phs})`);
    vals.push(...fv);
  }

  // excludeNonSku filter
  if (sp.get("excludeNonSku") === "1") {
    conds.push(`d.is_non_sku = FALSE`);
  }

  return { conds, nextIdx: i };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  try {
    const dims = [
      { key: "branches", col: "d.branch",  param: "branch", nullFilter: "d.branch IS NOT NULL" },
      { key: "stores",   col: "d.toko",    param: "store",  nullFilter: "d.toko IS NOT NULL AND d.toko != ''" },
      { key: "genders",  col: "d.gender",  param: "gender", nullFilter: "d.gender IS NOT NULL" },
      { key: "series",   col: "d.series",  param: "series", nullFilter: "d.series IS NOT NULL" },
      { key: "colors",   col: "d.color",   param: "color",  nullFilter: "d.color IS NOT NULL AND d.color != ''" },
      { key: "tiers",    col: "d.tier",    param: "tier",   nullFilter: "d.tier IS NOT NULL" },
      { key: "tipes",    col: "d.tipe",    param: "tipe",   nullFilter: "d.tipe IS NOT NULL" },
      { key: "versions", col: "d.version", param: "version", nullFilter: "d.version IS NOT NULL" },
      { key: "entities",  col: "d.source_entity", param: "entity",   nullFilter: "d.source_entity IS NOT NULL" },
      { key: "customers", col: "d.customer",       param: "customer", nullFilter: "d.customer IS NOT NULL AND d.customer != ''" },
    ] as const;

    const results = await Promise.all(
      dims.map(async (dim) => {
        const vals: unknown[] = [];
        const { conds } = buildWhereClause(sp, dim.param, vals, 1);
        conds.push(dim.nullFilter);

        const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
        const sql = `SELECT DISTINCT ${dim.col} AS val FROM mart.mv_accurate_summary d ${where} ORDER BY val`;
        const res = await pool.query(sql, vals);
        return { key: dim.key, values: res.rows.map((r: Record<string, unknown>) => r.val).filter((v) => v !== null && v !== '') };
      })
    );

    const body: Record<string, unknown[]> = {};
    for (const r of results) body[r.key] = r.values;

    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
    });
  } catch (e) {
    console.error("filter-options error:", e);
    return NextResponse.json({ error: "DB error", detail: String(e) }, { status: 500 });
  }
}
