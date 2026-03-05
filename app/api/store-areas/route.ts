import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Derive areas from store names - simplified
    const result = await pool.query(`
      SELECT DISTINCT 
        CASE 
          WHEN LOWER(nama_gudang) LIKE '%jakarta%' OR LOWER(nama_gudang) LIKE '%aeon%' THEN 'Jakarta'
          WHEN LOWER(nama_gudang) LIKE '%bali%' OR LOWER(nama_gudang) LIKE '%tabanan%' OR LOWER(nama_gudang) LIKE '%dalung%' OR LOWER(nama_gudang) LIKE '%kedonganan%' OR LOWER(nama_gudang) LIKE '%kesiman%' THEN 'Bali'
          WHEN LOWER(nama_gudang) LIKE '%lombok%' OR LOWER(nama_gudang) LIKE '%mataram%' THEN 'Lombok'
          WHEN LOWER(nama_gudang) LIKE '%medan%' OR LOWER(nama_gudang) LIKE '%pekanbaru%' THEN 'Sumatra'
          WHEN LOWER(nama_gudang) LIKE '%makassar%' OR LOWER(nama_gudang) LIKE '%gorontalo%' THEN 'Sulawesi'
          WHEN LOWER(nama_gudang) LIKE '%batam%' THEN 'Batam'
          WHEN LOWER(nama_gudang) LIKE '%bazar%' OR LOWER(nama_gudang) LIKE '%fair%' THEN 'Event'
          WHEN LOWER(nama_gudang) LIKE '%online%' OR LOWER(nama_gudang) LIKE '%tiktok%' THEN 'Online'
          WHEN LOWER(nama_gudang) LIKE '%wholesale%' THEN 'Wholesale'
          WHEN LOWER(nama_gudang) LIKE '%pusat%' THEN 'Pusat'
          ELSE 'Other'
        END as area,
        CASE 
          WHEN LOWER(nama_gudang) LIKE '%jakarta%' OR LOWER(nama_gudang) LIKE '%aeon%' THEN 'Jakarta'
          WHEN LOWER(nama_gudang) LIKE '%bali%' OR LOWER(nama_gudang) LIKE '%tabanan%' OR LOWER(nama_gudang) LIKE '%dalung%' OR LOWER(nama_gudang) LIKE '%kedonganan%' OR LOWER(nama_gudang) LIKE '%kesiman%' THEN 'Bali'
          WHEN LOWER(nama_gudang) LIKE '%lombok%' OR LOWER(nama_gudang) LIKE '%mataram%' THEN 'Lombok'
          WHEN LOWER(nama_gudang) LIKE '%medan%' OR LOWER(nama_gudang) LIKE '%pekanbaru%' THEN 'Sumatra'
          WHEN LOWER(nama_gudang) LIKE '%makassar%' OR LOWER(nama_gudang) LIKE '%gorontalo%' THEN 'Sulawesi'
          WHEN LOWER(nama_gudang) LIKE '%batam%' THEN 'Batam'
          WHEN LOWER(nama_gudang) LIKE '%bazar%' OR LOWER(nama_gudang) LIKE '%fair%' THEN 'Event'
          WHEN LOWER(nama_gudang) LIKE '%online%' OR LOWER(nama_gudang) LIKE '%tiktok%' THEN 'Online'
          WHEN LOWER(nama_gudang) LIKE '%wholesale%' THEN 'Wholesale'
          WHEN LOWER(nama_gudang) LIKE '%pusat%' THEN 'Pusat'
          ELSE 'Other'
        END as name
      FROM raw.accurate_sales_ddd 
      WHERE nama_gudang IS NOT NULL AND nama_gudang != ''
      ORDER BY area
    `);
    
    return NextResponse.json({ 
      data: result.rows,
      count: result.rows.length 
    });
  } catch (error) {
    console.error("Error fetching store areas:", error);
    return NextResponse.json({ error: "Failed to fetch store areas" }, { status: 500 });
  }
}
