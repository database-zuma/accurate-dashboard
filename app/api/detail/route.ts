import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function parseMulti(sp: URLSearchParams, key: string): string[] {
  const val = sp.get(key);
  if (!val) return [];
  return val.split(",").map((v) => v.trim()).filter(Boolean);
}

const ALLOWED_SORT_KODE = new Set([
  "toko", "kode", "article", "series", "gender", "tier", "color", "tipe",
  "pairs", "revenue", "avg_price"
]);
const ALLOWED_SORT_KB = new Set([
  "toko", "kode_besar", "article", "series", "gender", "tier", "color", "tipe",
  "pairs", "revenue", "avg_price"
]);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("mode") === "kode_besar" ? "kode_besar" : "kode";
  const isExport = sp.get("export") === "all";
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(sp.get("limit") || "50", 10)));
  const offset = (page - 1) * limit;

  const allowedSort = mode === "kode_besar" ? ALLOWED_SORT_KB : ALLOWED_SORT_KODE;
  const sortRaw = sp.get("sort") || "revenue";
  const sort = allowedSort.has(sortRaw) ? sortRaw : "revenue";
  const dir = sp.get("dir") === "asc" ? "ASC" : "DESC";

  try {
    const vals: unknown[] = [];
    const conds: string[] = [];
    let i = 1;

    const from = sp.get("from");
    const to = sp.get("to");
    if (from) { conds.push(`d.sale_date >= $${i++}`); vals.push(from); }
    if (to)   { conds.push(`d.sale_date <= $${i++}`); vals.push(to); }

    for (const [param, col] of [
      ["branch",  "d.branch"],
      ["store",   "d.toko"],
      ["series",  "COALESCE(NULLIF(d.kodemix_series, ''), 'Unknown')"],
      ["gender",  "COALESCE(NULLIF(d.kodemix_gender, ''), 'Unknown')"],
      ["tier",    "COALESCE(NULLIF(d.kodemix_tier, ''), 'Unknown')"],
      ["tipe",    "d.tipe"],
      ["version", "d.version"],
      ["entity",  "d.source_entity"],
      ["customer", "d.customer"],
    ] as [string, string][]) {
      const fv = parseMulti(sp, param);
      if (!fv.length) continue;
      const phs = fv.map(() => `$${i++}`).join(", ");
      conds.push(`${col} IN (${phs})`);
      vals.push(...fv);
    }

    const colorFv = parseMulti(sp, "color");
    if (colorFv.length) {
      const phs = colorFv.map(() => `$${i++}`).join(", ");
      conds.push(`COALESCE(NULLIF(d.kodemix_color, ''), 'Unknown') IN (${phs})`);
      vals.push(...colorFv);
    }

    if (sp.get("excludeNonSku") === "1") {
      conds.push(`d.is_non_sku = FALSE`);
    }

    const q = sp.get("q");
    if (q) {
      if (mode === "kode_besar") {
        conds.push(`(d.kode_besar ILIKE $${i} OR d.article ILIKE $${i} OR d.toko ILIKE $${i})`);
      } else {
        conds.push(`(d.kode ILIKE $${i} OR d.article ILIKE $${i} OR d.toko ILIKE $${i})`);
      }
      vals.push(`%${q}%`);
      i++;
    }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    let groupBy: string;
    let selectCols: string;
    let orderBy: string;

    if (mode === "kode_besar") {
      groupBy = `d.toko, d.kode_besar, d.article, 
                 COALESCE(NULLIF(d.kodemix_gender, ''), 'Unknown'), 
                 COALESCE(NULLIF(d.kodemix_series, ''), 'Unknown'),
                 COALESCE(NULLIF(d.kodemix_color, ''), 'Unknown'),
                 d.tipe,
                 COALESCE(NULLIF(d.tier, 'Unknown'), 'Unknown')`;
      
      selectCols = `d.toko,
                    d.kode_besar,
                    d.article,
                    COALESCE(NULLIF(d.kodemix_gender, ''), 'Unknown') as gender,
                    COALESCE(NULLIF(d.kodemix_series, ''), 'Unknown') as series,
                    COALESCE(NULLIF(d.kodemix_color, ''), 'Unknown') as color,
                    d.tipe,
                    COALESCE(NULLIF(d.tier, 'Unknown'), 'Unknown') as tier`;
      
      orderBy = sort === "toko" ? `d.toko ${dir}` :
                sort === "kode_besar" ? `d.kode_besar ${dir}` :
                sort === "article" ? `d.article ${dir}` :
                sort === "gender" ? `COALESCE(NULLIF(d.kodemix_gender, ''), 'Unknown') ${dir}` :
                sort === "series" ? `COALESCE(NULLIF(d.kodemix_series, ''), 'Unknown') ${dir}` :
                sort === "color" ? `COALESCE(NULLIF(d.kodemix_color, ''), 'Unknown') ${dir}` :
                sort === "tipe" ? `d.tipe ${dir}` :
                sort === "tier" ? `COALESCE(NULLIF(d.tier, 'Unknown'), 'Unknown') ${dir}` :
                `${sort} ${dir} NULLS LAST`;
    } else {
      groupBy = `d.toko, d.kode, d.article,
                 COALESCE(NULLIF(d.kodemix_gender, ''), 'Unknown'),
                 COALESCE(NULLIF(d.kodemix_series, ''), 'Unknown'),
                 COALESCE(NULLIF(d.kodemix_color, ''), 'Unknown'),
                 d.tipe,
                 COALESCE(NULLIF(d.tier, 'Unknown'), 'Unknown')`;
      
      selectCols = `d.toko,
                    d.kode,
                    d.article,
                    COALESCE(NULLIF(d.kodemix_gender, ''), 'Unknown') as gender,
                    COALESCE(NULLIF(d.kodemix_series, ''), 'Unknown') as series,
                    COALESCE(NULLIF(d.kodemix_color, ''), 'Unknown') as color,
                    d.tipe,
                    COALESCE(NULLIF(d.tier, 'Unknown'), 'Unknown') as tier`;
      
      orderBy = sort === "toko" ? `d.toko ${dir}` :
                sort === "kode" ? `d.kode ${dir}` :
                sort === "article" ? `d.article ${dir}` :
                sort === "gender" ? `COALESCE(NULLIF(d.kodemix_gender, ''), 'Unknown') ${dir}` :
                sort === "series" ? `COALESCE(NULLIF(d.kodemix_series, ''), 'Unknown') ${dir}` :
                sort === "color" ? `COALESCE(NULLIF(d.kodemix_color, ''), 'Unknown') ${dir}` :
                sort === "tipe" ? `d.tipe ${dir}` :
                sort === "tier" ? `COALESCE(NULLIF(d.tier, 'Unknown'), 'Unknown') ${dir}` :
                `${sort} ${dir} NULLS LAST`;
    }

    if (isExport) {
      const dataSql = `
        SELECT ${selectCols},
               SUM(d.pairs) AS pairs,
               SUM(d.revenue) AS revenue,
               CASE WHEN SUM(d.pairs) > 0 THEN SUM(d.revenue) / SUM(d.pairs) ELSE 0 END AS avg_price
        FROM mart.mv_accurate_summary d
        ${where}
        GROUP BY ${groupBy}
        ORDER BY ${orderBy}
      `;
      const dataRes = await pool.query(dataSql, vals);
      const rows = dataRes.rows.map((r: Record<string, unknown>) => ({
        ...r,
        pairs: Number(r.pairs),
        revenue: Number(r.revenue),
        avg_price: Number(r.avg_price),
      }));

      return NextResponse.json({ rows }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const countSql = `
      SELECT COUNT(*) AS total,
             COALESCE(SUM(sub.pairs), 0) AS total_pairs,
             COALESCE(SUM(sub.revenue), 0) AS total_revenue
      FROM (
        SELECT SUM(d.pairs) AS pairs, SUM(d.revenue) AS revenue
        FROM mart.mv_accurate_summary d
        ${where}
        GROUP BY ${groupBy}
      ) sub
    `;
    const dataSql = `
      SELECT ${selectCols},
             SUM(d.pairs) AS pairs,
             SUM(d.revenue) AS revenue,
             CASE WHEN SUM(d.pairs) > 0 THEN SUM(d.revenue) / SUM(d.pairs) ELSE 0 END AS avg_price
      FROM mart.mv_accurate_summary d
      ${where}
      GROUP BY ${groupBy}
      ORDER BY ${orderBy}
      LIMIT $${i} OFFSET $${i + 1}
    `;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countSql, vals),
      pool.query(dataSql, [...vals, limit, offset]),
    ]);

    const countRow = countRes.rows[0] ?? { total: 0, total_pairs: 0, total_revenue: 0 };
    const total = Number(countRow.total);
    const totalPairs = Number(countRow.total_pairs);
    const totalRevenue = Number(countRow.total_revenue);
    const rows = dataRes.rows.map((r: Record<string, unknown>) => ({
      ...r,
      pairs: Number(r.pairs),
      revenue: Number(r.revenue),
      avg_price: Number(r.avg_price),
    }));
    return NextResponse.json({
      rows,
      total,
      page,
      pages: Math.ceil(total / limit),
      totals: { pairs: totalPairs, revenue: totalRevenue },
    }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e) {
    console.error("detail error:", e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
