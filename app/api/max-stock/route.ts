import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Return empty for now - max stock can be added later
    return NextResponse.json({ 
      data: [],
      count: 0 
    });
  } catch (error) {
    console.error("Error fetching max stock:", error);
    return NextResponse.json({ error: "Failed to fetch max stock" }, { status: 500 });
  }
}
