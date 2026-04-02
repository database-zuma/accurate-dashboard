import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseMulti(sp: URLSearchParams, key: string): string[] {
  const val = sp.get(key);
  if (!val) return [];
  return val.split(",").map((v) => v.trim()).filter(Boolean);
}

const ALLOWED_SORT = new Set([
  "year", "month_num", "month_name",
  "branch", "area", "store_name", "kode_besar", "kode_kecil", "kode_mix", "kode_mix_size",
  "gender", "series", "color", "size", "tier", "tipe",
  "qty_sold", "revenue",
]);

const GROUP_COLS = `year, month_num, month_name, branch, area, store_name, kode_besar, kode_kecil, kode_mix, kode_mix_size, gender, series, color, size, tier, tipe, is_non_sku`;

const SELECT_COLS = `
  year, month_num, month_name, branch, area, store_name,
  kode_besar, kode_kecil, kode_mix, kode_mix_size,
  gender, series, color, size, tier, tipe,
  SUM(qty_sold) AS qty_sold,
  SUM(revenue) AS revenue
`;

function mapRow(r: Record<string, unknown>) {
  return {
    year:          Number(r.year),
    month_num:     Number(r.month_num),
    month_name:    r.month_name     as string,
    branch:        r.branch         as string,
    area:          r.area           as string,
    store_name:    r.store_name     as string,
    kode_besar:    r.kode_besar     as string,
    kode_kecil:    r.kode_kecil     as string,
    kode_mix:      r.kode_mix       as string,
    kode_mix_size: r.kode_mix_size  as string,
    gender:        r.gender         as string,
    series:        r.series         as string,
    color:         r.color          as string,
    size:          r.size           as string,
    tier:          r.tier           as string,
    tipe:          r.tipe           as string,
    qty_sold:      Number(r.qty_sold),
    revenue:       Number(r.revenue),
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
    sort === "year"      ? `year ${dir}, month_num DESC` :
    sort === "month_num" ? `month_num ${dir}, year DESC` :
    `${sort} ${dir} NULLS LAST`;

  try {
    const vals: unknown[] = [];
    const conds: string[] = [];
    let i = 1;

    const from = sp.get("from");
    const to   = sp.get("to");
    if (from) {
      conds.push(`year >= DATE_PART('year', $${i}::date) AND (year > DATE_PART('year', $${i}::date) OR month_num >= DATE_PART('month', $${i}::date))`);
      vals.push(from); i++;
    }
    if (to) {
      conds.push(`year <= DATE_PART('year', $${i}::date) AND (year < DATE_PART('year', $${i}::date) OR month_num <= DATE_PART('month', $${i}::date))`);
      vals.push(to); i++;
    }

    for (const [param, col] of [
      ["branch",  "branch"],
      ["store",   "store_name"],
      ["channel", "store_name"],
      ["series",  "series"],
      ["gender",  "gender"],
      ["tier",    "tier"],
      ["tipe",    "tipe"],
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
      conds.push(`color IN (${phs})`);
      vals.push(...colorFv);
    }

    if (sp.get("excludeNonSku") === "1") conds.push(`is_non_sku = FALSE`);

    const q = sp.get("q");
    if (q) {
      conds.push(`(kode_besar ILIKE $${i} OR store_name ILIKE $${i} OR kode_kecil ILIKE $${i} OR kode_mix ILIKE $${i})`);
      vals.push(`%${q}%`);
      i++;
    }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const groupBy = `GROUP BY year, month_num, month_name, branch, area, store_name, kode_besar, kode_kecil, kode_mix, kode_mix_size, gender, series, color, size, tier, tipe`;

    if (isExport) {
      const exportFormat = sp.get("format") || "json";
      const sql = `SELECT year, month_num, month_name, branch, area, store_name, kode_besar, kode_kecil, kode_mix, kode_mix_size, gender, series, color, size, tier, tipe, qty_sold, revenue FROM public.mv_detail_monthly ${where} ORDER BY year DESC, month_num DESC, store_name, kode_besar`;
      const res = await pool.query(sql, vals);

      if (exportFormat === "xlsx") {
        const headers = ["Year", "Month No.", "Month Name", "Branch", "Area", "Store Name", "Kode Besar", "Kode Kecil", "Kode Mix", "Kode Mix Size", "Gender", "Series", "Color", "Size", "Tier", "Tipe", "Qty Sold", "Revenue"];
        const wsData = [headers, ...res.rows.map(r => [r.year, r.month_num, r.month_name, r.branch, r.area, r.store_name, r.kode_besar, r.kode_kecil, r.kode_mix, r.kode_mix_size, r.gender, r.series, r.color, r.size, r.tier, r.tipe, Number(r.qty_sold), Number(r.revenue)])];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        return new Response(buf, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="detail-monthly.xlsx"`,
            "Cache-Control": "no-store",
          },
        });
      }

      if (exportFormat === "csv") {
        const headers = "Year,Month No.,Month Name,Branch,Area,Store Name,Kode Besar,Kode Kecil,Kode Mix,Kode Mix Size,Gender,Series,Color,Size,Tier,Tipe,Qty Sold,Revenue";
        const csvRows = res.rows.map(r => `${r.year},${r.month_num},"${r.month_name}","${r.branch}","${r.area}","${r.store_name}","${r.kode_besar}","${r.kode_kecil}","${r.kode_mix}","${r.kode_mix_size}","${r.gender}","${r.series}","${r.color}","${r.size}","${r.tier}","${r.tipe}",${r.qty_sold},${r.revenue}`);
        const csv = "\uFEFF" + headers + "\r\n" + csvRows.join("\r\n");
        return new Response(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="detail-monthly.csv"`,
            "Cache-Control": "no-store",
          },
        });
      }

      return NextResponse.json({ rows: res.rows.map(mapRow) }, { headers: { "Cache-Control": "no-store" } });
    }

    const countSql = `
      SELECT COUNT(*) AS total,
             COALESCE(SUM(qty_sold), 0) AS total_qty,
             COALESCE(SUM(revenue), 0) AS total_revenue
      FROM public.mv_detail_monthly ${where}
    `;
    const dataSql = `
      SELECT ${SELECT_COLS}
      FROM public.mv_detail_monthly
      ${where}
      ${groupBy}
      ORDER BY ${orderBy}
      LIMIT $${i} OFFSET $${i + 1}
    `;

    const [countRes, dataRes] = await Promise.all([
      pool.query(countSql, vals),
      pool.query(dataSql, [...vals, limit, offset]),
    ]);

    const countRow     = countRes.rows[0] ?? { total: 0, total_qty: 0, total_revenue: 0 };
    const total        = Number(countRow.total);
    const totalPairs   = Number(countRow.total_qty);
    const totalRevenue = Number(countRow.total_revenue);

    return NextResponse.json({
      rows:   dataRes.rows.map(mapRow),
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
