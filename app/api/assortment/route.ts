import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT DISTINCT 
        kode as article,
        product_name as article_name,
        gender,
        series,
        tier,
        tipe
      FROM stock_today
      WHERE kode IS NOT NULL
      ORDER BY article
      LIMIT 2000
    `);
    
    return NextResponse.json({ 
      data: result.rows,
      count: result.rows.length 
    });
  } catch (error) {
    console.error("Error fetching assortment:", error);
    return NextResponse.json({ error: "Failed to fetch assortment" }, { status: 500 });
  }
}
