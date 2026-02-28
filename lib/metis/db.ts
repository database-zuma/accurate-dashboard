import { pool } from "@/lib/db";

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export async function executeReadOnlyQuery(sql: string): Promise<QueryResult> {
  const trimmed = sql.trim();
  const upper = trimmed.toUpperCase();

  // Security: only allow read-only queries
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    throw new Error("Only SELECT/WITH queries are allowed. No mutations.");
  }

  // Block dangerous keywords
  const blocked = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER",
    "TRUNCATE", "CREATE", "GRANT", "REVOKE",
  ];
  for (const keyword of blocked) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(upper.split("FROM")[0] || "")) {
      throw new Error(`Blocked keyword detected: ${keyword}`);
    }
  }

  const client = await pool.connect();
  try {
    await client.query("SET statement_timeout = '15s'");
    const result = await client.query(trimmed);
    return {
      columns: result.fields.map((f) => f.name),
      rows: result.rows.slice(0, 200),
      rowCount: result.rowCount ?? 0,
    };
  } finally {
    client.release();
  }
}
