import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function parseMulti(sp: URLSearchParams, key: string): string[] {
  const val = sp.get(key);
  if (!val) return [];
  return val.split(",").map((v) => v.trim()).filter(Boolean);
}

const ALLOWED_SORT = new Set([
  "year", "month_num", "month_name", "kode_besar", "pairs", "revenue", "avg_price",
]);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const isExport = sp.get("export") === "all";
  const page  = Math.max(1, parseInt(sp.get("page")  || "1",  10));
  const limit = Math.min(200, Math.max(1, parseInt(sp.get("limit") || "50", 10)));
  const offset = (page - 1) * limit;

  const sortRaw = sp.get("sort") || "year";
  const sort    = ALLOWED_SORT.has(sortRaw) ? sortRaw : "year";
  const dir     = sp.get("dir") === "asc" ? "ASC" : "DESC";

  try {
    const vals: unknown[] = [];
    const conds: string[] = [];
    let i = 1;

    const from = sp.get("from");
    const to   = sp.get("to");
    if (from) { conds.push(`d.sale_date >= $${i++}`); vals.push(from); }
    if (to)   { conds.push(`d.sale_date <= $${i++}`); vals.push(to); }

    for (const [param, col] of [
      ["branch",   "d.branch"],
      ["store",    "d.toko"],
      ["channel",  "d.store_category"],
      ["series",   "COALESCE(NULLIF(d.kodemix_series, ''), 'Unknown')"],
      ["gender",   "COALESCE(NULLIF(d.kodemix_gender, ''), 'Unknown')"],
      ["tier",     "COALESCE(NULLIF(d.tier, ''), 'Unknown')"],
      ["tipe",     "d.tipe"],
      ["version",  "d.version"],
      ["entity",   "d.source_entity"],
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
      conds.push(`(d.kode_besar ILIKE $${i} OR d.article ILIKE $${i})`);
      vals.push(`%${q}%`);
      i++;
    }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const orderBy =
      sort === "year"       ? `year ${dir}, month_num ${dir}` :
      sort === "month_num"  ? `month_num ${dir}, year ${dir}` :
      sort === "month_name" ? `month_name ${dir}` :
      sort === "kode_besar" ? `d.kode_besar ${dir}` :
      `${sort} ${dir} NULLS LAST`;

    if (isExport) {
      const dataSql = `
        SELECT
          DATE_PART('year',  d.sale_date)::int            AS year,
          DATE_PART('month', d.sale_date)::int            AS month_num,
          TRIM(TO_CHAR(d.sale_date, 'Month'))             AS month_name,
          d.kode_besar,
          SUM(d.pairs)   AS pairs,
          SUM(d.revenue) AS revenue,
          CASE WHEN SUM(d.pairs) > 0 THEN SUM(d.revenue) / SUM(d.pairs) ELSE 0 END AS avg_price
        FROM mart.mv_accurate_summary d
        ${where}
        GROUP BY
          DATE_PART('year',  d.sale_date),
          DATE_PART('month', d.sale_date),
          TRIM(TO_CHAR(d.sale_date, 'Month')),
          d.kode_besar
        ORDER BY ${orderBy}
      `;
      const dataRes = await pool.query(dataSql, vals);
      const rows = dataRes.rows.map((r: Record<string, unknown>) => ({
        ...r,
        year:      Number(r.year),
        month_num: Number(r.month_num),
        pairs:     Number(r.pairs),
        revenue:   Number(r.revenue),
        avg_price: Number(r.avg_price),
      }));
      return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
    }

    const countSql = `
      SELECT COUNT(*) AS total,
             COALESCE(SUM(sub.pairs),   0) AS total_pairs,
             COALESCE(SUM(sub.revenue), 0) AS total_revenue
      FROM (
        SELECT SUM(d.pairs) AS pairs, SUM(d.revenue) AS revenue
        FROM mart.mv_accurate_summary d
        ${where}
        GROUP BY
          DATE_PART('year',  d.sale_date),
          DATE_PART('month', d.sale_date),
          TRIM(TO_CHAR(d.sale_date, 'Month')),
          d.kode_besar
      ) sub
    `;
    const dataSql = `
      SELECT
        DATE_PART('year',  d.sale_date)::int            AS year,
        DATE_PART('month', d.sale_date)::int            AS month_num,
        TRIM(TO_CHAR(d.sale_date, 'Month'))             AS month_name,
        d.kode_besar,
        SUM(d.pairs)   AS pairs,
        SUM(d.revenue) AS revenue,
        CASE WHEN SUM(d.pairs) > 0 THEN SUM(d.revenue) / SUM(d.pairs) ELSE 0 END AS avg_price
      FROM mart.mv_accurate_summary d
      ${where}
      GROUP BY
        DATE_PART('year',  d.sale_date),
        DATE_PART('month', d.sale_date),
        TRIM(TO_CHAR(d.sale_date, 'Month')),
        d.kode_besar
      ORDER BY ${orderBy}
      LIMIT $${i} OFFSET $${i + 1}
    `;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countSql, vals),
      pool.query(dataSql, [...vals, limit, offset]),
    ]);

    const countRow = countRes.rows[0] ?? { total: 0, total_pairs: 0, total_revenue: 0 };
    const total        = Number(countRow.total);
    const totalPairs   = Number(countRow.total_pairs);
    const totalRevenue = Number(countRow.total_revenue);

    const rows = dataRes.rows.map((r: Record<string, unknown>) => ({
      year:      Number(r.year),
      month_num: Number(r.month_num),
      month_name: r.month_name as string,
      kode_besar: r.kode_besar as string,
      pairs:     Number(r.pairs),
      revenue:   Number(r.revenue),
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
    console.error("detail-monthly error:", e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
