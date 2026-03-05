import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    // Get stock data grouped by entity (DDD, LJBB, MBB)
    const result = await pool.query(`
      SELECT 
        source_entity as entity,
        nama_gudang as store,
        kode as sku,
        product_name as article_name,
        ukuran as size,
        series,
        gender,
        tier,
        tipe,
        quantity as qty_on_hand
      FROM stock_today
      WHERE quantity > 0
      ORDER BY source_entity, nama_gudang, product_name, ukuran
      LIMIT 10000
    `);
    
    // Group by entity (DDD, LJBB, MBB)
    const grouped: Record<string, { warehouse: any[], retail: any[] }> = {};
    
    for (const row of result.rows) {
      const entity = row.entity || 'UNKNOWN';
      if (!grouped[entity]) {
        grouped[entity] = { warehouse: [], retail: [] };
      }
      
      // Determine if warehouse or retail based on store name
      const isRetail = row.store && !row.store.toLowerCase().includes('gudang') && !row.store.toLowerCase().includes('pusat');
      const targetArray = isRetail ? grouped[entity].retail : grouped[entity].warehouse;
      
      targetArray.push({
        sku: row.sku,
        article_name: row.article_name,
        size: row.size,
        series: row.series,
        gender: row.gender,
        tier: row.tier,
        tipe: row.tipe,
        qty_on_hand: row.qty_on_hand,
        store: row.store
      });
    }
    
    return NextResponse.json(grouped);
  } catch (error) {
    console.error("Error fetching stock:", error);
    return NextResponse.json({ error: "Failed to fetch stock" }, { status: 500 });
  }
}
