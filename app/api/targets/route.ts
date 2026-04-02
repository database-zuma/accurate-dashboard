import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT store_name as store, branch as area, year,
             COALESCE(jan,0)::bigint as jan, COALESCE(feb,0)::bigint as feb,
             COALESCE(mar,0)::bigint as mar, COALESCE(apr,0)::bigint as apr,
             COALESCE(may,0)::bigint as may, COALESCE(jun,0)::bigint as jun,
             COALESCE(jul,0)::bigint as jul, COALESCE(aug,0)::bigint as aug,
             COALESCE(sep,0)::bigint as sep, COALESCE(oct,0)::bigint as oct,
             COALESCE(nov,0)::bigint as nov, COALESCE(dec,0)::bigint as dec
      FROM portal.store_monthly_target
      WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
      ORDER BY store_name
    `);

    // Return as object keyed by index for dashboard compatibility
    const targetObj: Record<string, any> = {};
    result.rows.forEach((row: any, idx: number) => {
      targetObj[idx] = {
        store: row.store,
        area: row.area,
        year: row.year,
        jan: Number(row.jan),
        feb: Number(row.feb),
        mar: Number(row.mar),
        apr: Number(row.apr),
        may: Number(row.may),
        jun: Number(row.jun),
        jul: Number(row.jul),
        aug: Number(row.aug),
        sep: Number(row.sep),
        oct: Number(row.oct),
        nov: Number(row.nov),
        dec: Number(row.dec),
      };
    });

    return NextResponse.json(targetObj);
  } catch (error) {
    console.error("Error fetching targets:", error);
    return NextResponse.json({ error: "Failed to fetch targets" }, { status: 500 });
  }
}
