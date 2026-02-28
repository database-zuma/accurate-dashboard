import { pool } from "@/lib/db";
import { NextRequest } from "next/server";

/**
 * GET /api/metis/sessions?dashboard=accurate-sales
 * Returns the most recent session for this dashboard (Notion-style: always resume)
 */
export async function GET(req: NextRequest) {
  const dashboard = req.nextUrl.searchParams.get("dashboard") || "accurate-sales";

  const { rows } = await pool.query(
    `SELECT id, messages, created_at, updated_at
     FROM public.metis_sessions
     WHERE dashboard = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [dashboard]
  );

  if (rows.length === 0) {
    return Response.json({ session: null });
  }

  return Response.json({ session: rows[0] });
}

/**
 * POST /api/metis/sessions
 * Upsert a session (create or update messages)
 * Body: { id, dashboard, messages }
 */
export async function POST(req: Request) {
  const { id, dashboard = "accurate-sales", messages } = await req.json();

  if (!id || !Array.isArray(messages)) {
    return Response.json({ error: "id and messages[] required" }, { status: 400 });
  }

  await pool.query(
    `INSERT INTO public.metis_sessions (id, dashboard, messages, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (id)
     DO UPDATE SET messages = $3::jsonb, updated_at = NOW()`,
    [id, dashboard, JSON.stringify(messages)]
  );

  return Response.json({ ok: true });
}
