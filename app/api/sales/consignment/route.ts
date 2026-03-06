import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CONSIG_FILTER = `nama_departemen ILIKE ANY(ARRAY['%pepito%','%aeon%','%bintang%','%grand lucky%','%omosando%','%clandys%','%sogo%','%ciluba%','%royal surf%','%bali united%','%sonobebe%'])`;

const AREA_CASE = `
  CASE
    WHEN nama_departemen ILIKE '%aeon%' OR nama_departemen ILIKE '%jakarta%' THEN 'Jakarta'
    WHEN nama_departemen ILIKE '%lombok%' THEN 'Lombok'
    ELSE 'Bali'
  END
`;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") || "2026-01-01";
    const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);

    // Summary per area (derived from nama_departemen)
    const areaQ = pool.query(`
      SELECT 
        ${AREA_CASE} as area,
        COUNT(DISTINCT nama_departemen) as total_partners,
        COUNT(DISTINCT kode_produk) as total_sku,
        SUM(kuantitas) as total_qty,
        ROUND(SUM(total_harga)) as total_sales,
        COUNT(DISTINCT COALESCE(NULLIF(nama_gudang, ''), nama_departemen)) as total_stores
      FROM raw.accurate_sales_ddd
      WHERE ${CONSIG_FILTER}
      AND tanggal::date BETWEEN $1 AND $2
      GROUP BY ${AREA_CASE}
      ORDER BY total_sales DESC
    `, [from, to]);

    // Breakdown per store (nama_gudang) with area
    const storeQ = pool.query(`
      SELECT 
        COALESCE(NULLIF(nama_gudang, ''), nama_departemen) as store_name,
        ${AREA_CASE} as area,
        SUM(kuantitas) as qty,
        ROUND(SUM(total_harga)) as sales,
        COUNT(DISTINCT kode_produk) as sku_count
      FROM raw.accurate_sales_ddd
      WHERE ${CONSIG_FILTER}
      AND tanggal::date BETWEEN $1 AND $2
      GROUP BY COALESCE(NULLIF(nama_gudang, ''), nama_departemen), ${AREA_CASE}
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
      WHERE ${CONSIG_FILTER}
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
        ROUND(SUM(total_harga)) as sales
      FROM raw.accurate_sales_ddd
      WHERE ${CONSIG_FILTER}
      AND tanggal::date BETWEEN $1 AND $2
      GROUP BY TO_CHAR(tanggal::date, 'YYYY-MM')
      ORDER BY month
    `, [from, to]);

    const [areas, stores, products, trend] = await Promise.all([areaQ, storeQ, productQ, trendQ]);

    // Calculate grand totals
    const grandTotal = areas.rows.reduce((acc: any, r: any) => ({
      total_qty: (acc.total_qty || 0) + Number(r.total_qty),
      total_sales: (acc.total_sales || 0) + Number(r.total_sales),
      total_sku: (acc.total_sku || 0) + Number(r.total_sku),
    }), {});

    return NextResponse.json({
      grand_total: grandTotal,
      areas: areas.rows,
      stores: stores.rows,
      top_products: products.rows,
      monthly_trend: trend.rows,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
