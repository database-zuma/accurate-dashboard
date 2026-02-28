import { tool } from "ai";
import { z } from "zod";
import { executeReadOnlyQuery } from "./db";

export const metisTools = {
  queryDatabase: tool({
    description:
      "Execute a read-only SQL query against the Zuma PostgreSQL database. " +
      "Use core.sales_with_product for sales analysis and core.stock_with_product for stock analysis. " +
      "ALWAYS include mandatory filters: is_intercompany = FALSE and exclude non-product items. " +
      "ALWAYS add LIMIT clause for non-aggregation queries.",
    inputSchema: z.object({
      sql: z
        .string()
        .describe("The SELECT SQL query to execute against the database"),
      purpose: z
        .string()
        .describe("Brief description of what this query is trying to find out"),
    }),
    execute: async ({ sql, purpose }) => {
      try {
        const result = await executeReadOnlyQuery(sql);
        return {
          success: true,
          purpose,
          columns: result.columns,
          rows: result.rows,
          rowCount: result.rowCount,
          truncated: result.rowCount > 200,
        };
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          success: false,
          purpose,
          error: message,
          columns: [],
          rows: [],
          rowCount: 0,
        };
      }
    },
  }),
};
