import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT 
        kode as sku,
        product_name as article_name,
        ukuran as size,
        series,
        gender,
        tier,
        quantity as qty_on_hand,
        nama_gudang as store
      FROM stock_today
      WHERE quantity > 0
      ORDER BY nama_gudang, product_name, ukuran
      LIMIT 5000
    `);
    
    return NextResponse.json({ 
      data: result.rows,
      count: result.rows.length 
    });
  } catch (error) {
    console.error("Error fetching stock:", error);
    return NextResponse.json({ error: "Failed to fetch stock" }, { status: 500 });
  }
}
