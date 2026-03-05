import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT DISTINCT 
        LOWER(TRIM(nama_gudang)) as store,
        nama_gudang as store_name
      FROM raw.accurate_sales_ddd 
      WHERE LOWER(TRIM(nama_gudang)) LIKE '%zuma%'
         OR LOWER(TRIM(nama_gudang)) LIKE '%bazar%'
         OR LOWER(TRIM(nama_gudang)) LIKE '%wholesale%'
         OR LOWER(TRIM(nama_gudang)) LIKE '%online%'
      ORDER BY store_name
    `);
    
    return NextResponse.json({ 
      data: result.rows,
      count: result.rows.length 
    });
  } catch (error) {
    console.error("Error fetching stores:", error);
    return NextResponse.json({ error: "Failed to fetch stores" }, { status: 500 });
  }
}
