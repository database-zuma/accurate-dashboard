import { pool } from "@/lib/db";
import { NextRequest } from "next/server";

/**
 * GET /api/metis/sessions?dashboard=accurate-sales&uid=u-xxx
 * Returns ALL sessions for this user+dashboard (newest first), max 50
 */
export async function GET(req: NextRequest) {
  const dashboard = req.nextUrl.searchParams.get("dashboard") || "accurate-sales";
  const uid = req.nextUrl.searchParams.get("uid") || "";

  const { rows } = await pool.query(
    `SELECT id, title, messages, created_at, updated_at
     FROM public.metis_sessions
     WHERE dashboard = $1 AND uid = $2
     ORDER BY updated_at DESC
     LIMIT 50`,
    [dashboard, uid]
  );

  return Response.json({ sessions: rows });
}

/**
 * POST /api/metis/sessions
 * Upsert a session (create or update messages + title)
 * Body: { id, dashboard, messages, title?, uid }
 */
export async function POST(req: Request) {
  const { id, dashboard = "accurate-sales", messages, title, uid = "" } =
    await req.json();

  if (!id || !Array.isArray(messages)) {
    return Response.json(
      { error: "id and messages[] required" },
      { status: 400 }
    );
  }

  // Auto-generate title from first user message if not provided
  const autoTitle =
    title ||
    messages.find((m: { role: string }) => m.role === "user")?.parts?.[0]
      ?.text?.slice(0, 60) ||
    "";

  await pool.query(
    `INSERT INTO public.metis_sessions (id, dashboard, messages, title, uid, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, $5, NOW())
     ON CONFLICT (id)
     DO UPDATE SET messages = $3::jsonb, title = COALESCE(NULLIF($4, ''), public.metis_sessions.title), updated_at = NOW()`,
    [id, dashboard, JSON.stringify(messages), autoTitle, uid]
  );

  return Response.json({ ok: true });
}

/**
 * PATCH /api/metis/sessions
 * Rename a session
 * Body: { id, title }
 */
export async function PATCH(req: Request) {
  const { id, title } = await req.json();

  if (!id || typeof title !== "string") {
    return Response.json(
      { error: "id and title required" },
      { status: 400 }
    );
  }

  await pool.query(
    `UPDATE public.metis_sessions SET title = $2, updated_at = NOW() WHERE id = $1`,
    [id, title.slice(0, 120)]
  );

  return Response.json({ ok: true });
}

/**
 * DELETE /api/metis/sessions
 * Body: { id }
 */
export async function DELETE(req: Request) {
  const { id } = await req.json();

  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }

  await pool.query(`DELETE FROM public.metis_sessions WHERE id = $1`, [id]);

  return Response.json({ ok: true });
}
