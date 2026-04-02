import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const REFUND_FILTER = `
  COALESCE(NULLIF(jumlah_pengembalian,''),'0')::numeric > 0
  AND tanggal_pesanan::date BETWEEN $1 AND $2
  AND tahun = '2026'
  AND LOWER(toko) NOT LIKE '%event%'
  AND LOWER(toko) NOT LIKE '%pameran%'
`;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") || "2026-01-01";
  const to = sp.get("to") || new Date().toISOString().slice(0, 10);

  try {
    const params = [from, to];

    const [summaryRes, areaRes, storeRes, articleRes, spgRes, monthlyRes, detailRes] = await Promise.all([
      // 1. Summary
      pool.query(`
        SELECT 
          COUNT(*) as refund_rows,
          SUM(COALESCE(NULLIF(jumlah_pengembalian,''),'0')::numeric) as refund_qty,
          SUM(COALESCE(NULLIF(total_refund_amount,''),'0')::numeric) as refund_value
        FROM core.iseller WHERE ${REFUND_FILTER}
      `, params),

      // 2. By area
      pool.query(`
        SELECT 
          COALESCE(NULLIF(area,''), COALESCE(NULLIF(branch,''), 'Unknown')) as area,
          SUM(COALESCE(NULLIF(jumlah_pengembalian,''),'0')::numeric) as refund_qty,
          SUM(COALESCE(NULLIF(total_refund_amount,''),'0')::numeric) as refund_value
        FROM core.iseller WHERE ${REFUND_FILTER}
        GROUP BY 1 ORDER BY refund_qty DESC
      `, params),

      // 3. By store
      pool.query(`
        SELECT 
          toko,
          COALESCE(NULLIF(area,''), COALESCE(NULLIF(branch,''), 'Unknown')) as area,
          SUM(COALESCE(NULLIF(jumlah_pengembalian,''),'0')::numeric) as refund_qty,
          SUM(COALESCE(NULLIF(total_refund_amount,''),'0')::numeric) as refund_value
        FROM core.iseller WHERE ${REFUND_FILTER}
        GROUP BY toko, 2 ORDER BY refund_qty DESC
      `, params),

      // 4. By article (top 30)
      pool.query(`
        SELECT 
          COALESCE(article, produk, 'Unknown') as article,
          COALESCE(series, '-') as series,
          COALESCE(gender, '-') as gender,
          SUM(COALESCE(NULLIF(jumlah_pengembalian,''),'0')::numeric) as refund_qty,
          SUM(COALESCE(NULLIF(total_refund_amount,''),'0')::numeric) as refund_value
        FROM core.iseller WHERE ${REFUND_FILTER} AND article IS NOT NULL
        GROUP BY 1,2,3 ORDER BY refund_qty DESC LIMIT 30
      `, params),

      // 5. By SPG
      pool.query(`
        SELECT 
          COALESCE(NULLIF(TRIM(kasir),''), 'Unknown') as spg,
          toko,
          SUM(COALESCE(NULLIF(jumlah_pengembalian,''),'0')::numeric) as refund_qty,
          SUM(COALESCE(NULLIF(total_refund_amount,''),'0')::numeric) as refund_value
        FROM core.iseller WHERE ${REFUND_FILTER}
        GROUP BY 1, toko ORDER BY refund_qty DESC
      `, params),

      // 6. Monthly trend
      pool.query(`
        SELECT 
          TO_CHAR(tanggal_pesanan::date, 'YYYY-MM') as month,
          SUM(COALESCE(NULLIF(jumlah_pengembalian,''),'0')::numeric) as refund_qty,
          SUM(COALESCE(NULLIF(total_refund_amount,''),'0')::numeric) as refund_value
        FROM core.iseller WHERE ${REFUND_FILTER}
        GROUP BY 1 ORDER BY month
      `, params),

      // 7. Detail rows (last 200)
      pool.query(`
        SELECT 
          tanggal_pesanan::date as date,
          nomor_pesanan as order_no,
          toko, kasir as spg, sku, 
          COALESCE(article, produk) as article,
          COALESCE(NULLIF(jumlah_pengembalian,''),'0')::numeric as refund_qty,
          COALESCE(NULLIF(total_refund_amount,''),'0')::numeric as refund_value,
          COALESCE(NULLIF(harga_asli,''),'0')::numeric as price,
          COALESCE(NULLIF(area,''), COALESCE(NULLIF(branch,''), 'Unknown')) as area,
          gender, series
        FROM core.iseller WHERE ${REFUND_FILTER}
        ORDER BY tanggal_pesanan DESC LIMIT 200
      `, params),
    ]);

    const summary = summaryRes.rows[0];
    const toNum = (v: any) => Number(v || 0);

    return NextResponse.json({
      summary: {
        refund_qty: toNum(summary.refund_qty),
        refund_value: toNum(summary.refund_value),
      },
      by_area: areaRes.rows.map((r: any) => ({
        area: r.area, refund_qty: toNum(r.refund_qty), refund_value: toNum(r.refund_value),
      })),
      by_store: storeRes.rows.map((r: any) => ({
        toko: r.toko, area: r.area, refund_qty: toNum(r.refund_qty), refund_value: toNum(r.refund_value),
      })),
      by_article: articleRes.rows.map((r: any) => ({
        article: r.article, series: r.series, gender: r.gender,
        refund_qty: toNum(r.refund_qty), refund_value: toNum(r.refund_value),
      })),
      by_spg: spgRes.rows.map((r: any) => ({
        spg: r.spg, toko: r.toko, refund_qty: toNum(r.refund_qty), refund_value: toNum(r.refund_value),
      })),
      monthly_trend: monthlyRes.rows.map((r: any) => ({
        month: r.month, refund_qty: toNum(r.refund_qty), refund_value: toNum(r.refund_value),
      })),
      detail: detailRes.rows.map((r: any) => ({
        date: r.date, order_no: r.order_no, toko: r.toko, spg: r.spg,
        sku: r.sku, article: r.article, refund_qty: toNum(r.refund_qty),
        refund_value: toNum(r.refund_value), price: toNum(r.price),
        area: r.area, gender: r.gender, series: r.series,
      })),
    });
  } catch (e) {
    console.error("refunds error:", e);
    return NextResponse.json({ error: "DB error", details: String(e) }, { status: 500 });
  }
}
