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
  "year", "month_num", "month_name",
  "branch", "area", "toko", "kode_besar", "kode_kecil", "kode_mix", "kode_mix_size", "size",
  "article", "gender", "series", "color", "tipe", "tier",
  "pairs", "revenue", "avg_price",
]);

const GROUP_BY = `
  DATE_PART('year',  d.sale_date),
  DATE_PART('month', d.sale_date),
  TRIM(TO_CHAR(d.sale_date, 'Month')),
  COALESCE(d.branch, 'Unknown'),
  d.toko,
  d.kode_besar,
  COALESCE(d.kode, ''),
  COALESCE(d.kode_mix, ''),
  COALESCE(d.size, ''),
  d.article,
  COALESCE(NULLIF(d.kodemix_gender, ''), 'Unknown'),
  COALESCE(NULLIF(d.kodemix_series, ''), 'Unknown'),
  COALESCE(NULLIF(d.kodemix_color,  ''), 'Unknown'),
  d.tipe,
  COALESCE(NULLIF(d.tier, 'Unknown'), 'Unknown')
`;

const SELECT_COLS = `
  DATE_PART('year',  d.sale_date)::int                      AS year,
  DATE_PART('month', d.sale_date)::int                      AS month_num,
  TRIM(TO_CHAR(d.sale_date, 'Month'))                       AS month_name,
  COALESCE(d.branch, 'Unknown')                             AS branch,
  d.toko,
  d.kode_besar,
  COALESCE(d.kode, '')                                      AS kode_kecil,
  COALESCE(d.kode_mix, '')                                  AS kode_mix,
  COALESCE(d.size, '')                                      AS size,
  d.article,
  COALESCE(NULLIF(d.kodemix_gender, ''), 'Unknown')         AS gender,
  COALESCE(NULLIF(d.kodemix_series, ''), 'Unknown')         AS series,
  COALESCE(NULLIF(d.kodemix_color,  ''), 'Unknown')         AS color,
  d.tipe,
  COALESCE(NULLIF(d.tier, 'Unknown'), 'Unknown')            AS tier,
  SUM(d.pairs)                                              AS pairs,
  SUM(d.revenue)                                            AS revenue,
  CASE WHEN SUM(d.pairs) > 0
       THEN SUM(d.revenue) / SUM(d.pairs) ELSE 0 END        AS avg_price
`;

// Lightweight area + kode_mix_size lookup (post-query, using small portal tables only)
async function enrichRows(rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  if (!rows.length) return rows;

  // Get unique toko values for area lookup
  const tokos = [...new Set(rows.map(r => (r.toko as string || '').toLowerCase()))];
  const kodeBesars = [...new Set(rows.map(r => (r.kode_besar as string || '').toLowerCase()))];

  // Batch lookup area from a lightweight portal table or branch mapping
  let areaMap: Record<string, string> = {};
  try {
    const areaRes = await pool.query(`
      SELECT LOWER(store_name) AS toko, area
      FROM (
        SELECT DISTINCT matched_store_name AS store_name, area
        FROM core.sales_with_product
        WHERE matched_store_name IS NOT NULL AND area IS NOT NULL AND area != ''
        AND LOWER(matched_store_name) = ANY($1)
      ) sub
    `, [tokos]);
    for (const r of areaRes.rows) areaMap[r.toko] = r.area;
  } catch { /* skip area if fails */ }

  // Batch lookup kode_mix_size from portal.kodemix
  let kmSizeMap: Record<string, string> = {};
  try {
    const kmRes = await pool.query(`
      SELECT LOWER(kode_besar) AS kb, kode_mix_size
      FROM portal.kodemix
      WHERE LOWER(kode_besar) = ANY($1) AND kode_mix_size IS NOT NULL AND kode_mix_size != ''
    `, [kodeBesars]);
    for (const r of kmRes.rows) kmSizeMap[r.kb] = r.kode_mix_size;
  } catch { /* skip kode_mix_size if fails */ }

  return rows.map(r => ({
    ...mapRow(r),
    area: areaMap[(r.toko as string || '').toLowerCase()] || '',
    kode_mix_size: kmSizeMap[(r.kode_besar as string || '').toLowerCase()] || '',
  }));
}

function mapRow(r: Record<string, unknown>) {
  return {
    year:       Number(r.year),
    month_num:  Number(r.month_num),
    month_name: r.month_name     as string,
    branch:     r.branch         as string,
    area:       '',
    toko:       r.toko           as string,
    kode_besar: r.kode_besar     as string,
    kode_kecil: r.kode_kecil     as string,
    kode_mix:   r.kode_mix       as string,
    kode_mix_size: '',
    size:       r.size           as string,
    article:    r.article        as string,
    gender:     r.gender         as string,
    series:     r.series         as string,
    color:      r.color          as string,
    tipe:       r.tipe           as string,
    tier:       r.tier           as string,
    pairs:      Number(r.pairs),
    revenue:    Number(r.revenue),
    avg_price:  Number(r.avg_price),
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const isExport = sp.get("export") === "all";
  const page   = Math.max(1, parseInt(sp.get("page")  || "1",  10));
  const limit  = Math.min(200, Math.max(1, parseInt(sp.get("limit") || "50", 10)));
  const offset = (page - 1) * limit;

  const sortRaw = sp.get("sort") || "year";
  const sort    = ALLOWED_SORT.has(sortRaw) ? sortRaw : "year";
  const dir     = sp.get("dir") === "asc" ? "ASC" : "DESC";

  const orderBy =
    sort === "year"       ? `year ${dir}, month_num DESC` :
    sort === "month_num"  ? `month_num ${dir}, year DESC` :
    sort === "month_name" ? `month_name ${dir}` :
    sort === "branch"     ? `COALESCE(d.branch, 'Unknown') ${dir}` :
    sort === "toko"       ? `d.toko ${dir}` :
    sort === "kode_besar" ? `d.kode_besar ${dir}` :
    sort === "kode_kecil" ? `COALESCE(d.kode, '') ${dir}` :
    sort === "kode_mix"   ? `COALESCE(d.kode_mix, '') ${dir}` :
    sort === "size"       ? `COALESCE(d.size, '') ${dir}` :
    sort === "article"    ? `d.article ${dir}` :
    sort === "gender"     ? `COALESCE(NULLIF(d.kodemix_gender, ''), 'Unknown') ${dir}` :
    sort === "series"     ? `COALESCE(NULLIF(d.kodemix_series, ''), 'Unknown') ${dir}` :
    sort === "color"      ? `COALESCE(NULLIF(d.kodemix_color,  ''), 'Unknown') ${dir}` :
    sort === "tipe"       ? `d.tipe ${dir}` :
    sort === "tier"       ? `COALESCE(NULLIF(d.tier, 'Unknown'), 'Unknown') ${dir}` :
    `${sort} ${dir} NULLS LAST`;

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
      ["tier",     "COALESCE(NULLIF(d.tier, 'Unknown'), 'Unknown')"],
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

    if (sp.get("excludeNonSku") === "1") conds.push(`d.is_non_sku = FALSE`);

    const q = sp.get("q");
    if (q) {
      conds.push(`(d.kode_besar ILIKE $${i} OR d.article ILIKE $${i} OR d.toko ILIKE $${i})`);
      vals.push(`%${q}%`);
      i++;
    }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    if (isExport) {
      const sql = `SELECT ${SELECT_COLS} FROM mart.mv_accurate_summary d ${where} GROUP BY ${GROUP_BY} ORDER BY ${orderBy}`;
      const res  = await pool.query(sql, vals);
      const enriched = await enrichRows(res.rows);
      return NextResponse.json({ rows: enriched }, { headers: { "Cache-Control": "no-store" } });
    }

    const countSql = `
      SELECT COUNT(*) AS total,
             COALESCE(SUM(sub.pairs),   0) AS total_pairs,
             COALESCE(SUM(sub.revenue), 0) AS total_revenue
      FROM (
        SELECT SUM(d.pairs) AS pairs, SUM(d.revenue) AS revenue
        FROM mart.mv_accurate_summary d
        ${where}
        GROUP BY ${GROUP_BY}
      ) sub
    `;
    const dataSql = `
      SELECT ${SELECT_COLS}
      FROM mart.mv_accurate_summary d
      ${where}
      GROUP BY ${GROUP_BY}
      ORDER BY ${orderBy}
      LIMIT $${i} OFFSET $${i + 1}
    `;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countSql, vals),
      pool.query(dataSql, [...vals, limit, offset]),
    ]);

    const countRow     = countRes.rows[0] ?? { total: 0, total_pairs: 0, total_revenue: 0 };
    const total        = Number(countRow.total);
    const totalPairs   = Number(countRow.total_pairs);
    const totalRevenue = Number(countRow.total_revenue);

    const enriched = await enrichRows(dataRes.rows);

    return NextResponse.json({
      rows:   enriched,
      total,
      page,
      pages:  Math.ceil(total / limit),
      totals: { pairs: totalPairs, revenue: totalRevenue },
    }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e) {
    console.error("detail-monthly error:", e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
