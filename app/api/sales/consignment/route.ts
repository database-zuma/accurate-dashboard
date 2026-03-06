import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") || "2026-01-01";
    const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);

    // Summary per partner (nama_departemen)
    const summaryQ = pool.query(`
      SELECT 
        nama_departemen as partner,
        COUNT(DISTINCT kode_produk) as total_sku,
        SUM(kuantitas) as total_qty,
        ROUND(SUM(total_harga)) as total_sales,
        COUNT(DISTINCT nomor_invoice) as total_trx,
        COUNT(DISTINCT nama_gudang) FILTER (WHERE nama_gudang IS NOT NULL AND nama_gudang != '') as total_stores
      FROM raw.accurate_sales_ddd
      WHERE (
        nama_departemen ILIKE ANY(ARRAY['%pepito%','%aeon%','%bintang%','%grand lucky%','%omosando%','%clandys%','%sogo%','%ciluba%','%royal surf%','%bali united%','%sonobebe%'])
      )
      AND tanggal::date BETWEEN $1 AND $2
      GROUP BY nama_departemen
      ORDER BY total_sales DESC
    `, [from, to]);

    // Breakdown per store (nama_gudang) within each partner
    const storeQ = pool.query(`
      SELECT 
        nama_departemen as partner,
        COALESCE(NULLIF(nama_gudang, ''), nama_departemen) as store_name,
        SUM(kuantitas) as qty,
        ROUND(SUM(total_harga)) as sales,
        COUNT(DISTINCT kode_produk) as sku_count,
        COUNT(DISTINCT nomor_invoice) as trx
      FROM raw.accurate_sales_ddd
      WHERE (
        nama_departemen ILIKE ANY(ARRAY['%pepito%','%aeon%','%bintang%','%grand lucky%','%omosando%','%clandys%','%sogo%','%ciluba%','%royal surf%','%bali united%','%sonobebe%'])
      )
      AND tanggal::date BETWEEN $1 AND $2
      GROUP BY nama_departemen, COALESCE(NULLIF(nama_gudang, ''), nama_departemen)
      ORDER BY sales DESC
    `, [from, to]);

    // Top products
    const productQ = pool.query(`
      SELECT 
        kode_produk as sku,
        nama_barang as product_name,
        SUM(kuantitas) as qty,
        ROUND(SUM(total_harga)) as sales
      FROM raw.accurate_sales_ddd
      WHERE (
        nama_departemen ILIKE ANY(ARRAY['%pepito%','%aeon%','%bintang%','%grand lucky%','%omosando%','%clandys%','%sogo%','%ciluba%','%royal surf%','%bali united%','%sonobebe%'])
      )
      AND tanggal::date BETWEEN $1 AND $2
      GROUP BY kode_produk, nama_barang
      ORDER BY sales DESC
      LIMIT 20
    `, [from, to]);

    // Monthly trend
    const trendQ = pool.query(`
      SELECT 
        TO_CHAR(tanggal::date, 'YYYY-MM') as month,
        SUM(kuantitas) as qty,
        ROUND(SUM(total_harga)) as sales,
        COUNT(DISTINCT nomor_invoice) as trx
      FROM raw.accurate_sales_ddd
      WHERE (
        nama_departemen ILIKE ANY(ARRAY['%pepito%','%aeon%','%bintang%','%grand lucky%','%omosando%','%clandys%','%sogo%','%ciluba%','%royal surf%','%bali united%','%sonobebe%'])
      )
      AND tanggal::date BETWEEN $1 AND $2
      GROUP BY TO_CHAR(tanggal::date, 'YYYY-MM')
      ORDER BY month
    `, [from, to]);

    const [summary, stores, products, trend] = await Promise.all([summaryQ, storeQ, productQ, trendQ]);

    // Calculate grand totals
    const grandTotal = summary.rows.reduce((acc: any, r: any) => ({
      total_qty: (acc.total_qty || 0) + Number(r.total_qty),
      total_sales: (acc.total_sales || 0) + Number(r.total_sales),
      total_trx: (acc.total_trx || 0) + Number(r.total_trx),
      total_sku: (acc.total_sku || 0) + Number(r.total_sku),
    }), {});

    return NextResponse.json({
      grand_total: grandTotal,
      partners: summary.rows,
      stores: stores.rows,
      top_products: products.rows,
      monthly_trend: trend.rows,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
