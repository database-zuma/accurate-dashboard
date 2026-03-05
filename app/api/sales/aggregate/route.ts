import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start_date") || "2026-01-01";
  const endDate = searchParams.get("end_date") || "2026-12-31";
  
  try {
    // Get sales with returns aggregated by store
    const query = `
      WITH sales AS (
        SELECT 
          LOWER(TRIM(s.nama_gudang)) as store,
          s.tanggal as sale_date,
          SUM(s.total_harga) as total,
          SUM(s.kuantitas) as qty,
          COUNT(DISTINCT s.nomor_invoice) as trx
        FROM raw.accurate_sales_ddd s
        WHERE s.tanggal BETWEEN $1 AND $2
        AND LOWER(TRIM(s.nama_gudang)) LIKE '%zuma%'
        GROUP BY LOWER(TRIM(s.nama_gudang)), s.tanggal
      ),
      returns AS (
        SELECT 
          r.store_name,
          r.sale_date,
          SUM(r.return_qty) as retur_qty,
          SUM(r.return_amount) as retur_amt
        FROM raw.iseller_returns_by_store r
        WHERE r.return_qty > 0
        AND r.sale_date BETWEEN $1 AND $2
        GROUP BY r.store_name, r.sale_date
      )
      SELECT 
        s.store,
        s.sale_date,
        s.total,
        s.qty,
        s.trx,
        COALESCE(r.retur_qty, 0) as retur_qty,
        COALESCE(r.retur_amt, 0) as retur_amt
      FROM sales s
      LEFT JOIN returns r ON s.store = r.store_name AND s.sale_date = r.sale_date
      ORDER BY s.sale_date DESC, s.total DESC
    `;

    const result = await pool.query(query, [startDate, endDate]);
    
    return NextResponse.json({
      data: result.rows,
      count: result.rows.length,
      start_date: startDate,
      end_date: endDate
    });
  } catch (error) {
    console.error("Error fetching sales with returns:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales data", details: String(error) },
      { status: 500 }
    );
  }
}
