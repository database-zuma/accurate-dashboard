import { tool } from "ai";
import { z } from "zod";
import { executeReadOnlyQuery } from "./db";

// ============================================
// Calculator: safe math evaluation
// ============================================
function safeEval(expr: string): number {
  // Only allow numbers, operators, parentheses, and decimals
  const sanitized = expr.replace(/[^0-9+\-*/.()% ]/g, "");
  try {
    // eslint-disable-next-line no-eval
    const result = eval(sanitized);
    return typeof result === "number" && isFinite(result) ? result : NaN;
  } catch {
    return NaN;
  }
}

// ============================================
// Firecrawl: web scraping
// ============================================
async function scrapeUrl(url: string, prompt?: string) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY not configured");
  }

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "html"],
      prompt: prompt || "Extract all relevant content from this page",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firecrawl error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    success: true,
    url,
    markdown: data.data?.markdown || "",
    html: data.data?.html || "",
    title: data.data?.metadata?.title || "",
  };
}

// ============================================
// Exa AI: web search (alternative to Brave)
// ============================================
async function exaSearch(query: string, numResults: number = 5) {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error("EXA_API_KEY not configured");
  }

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      num_results: numResults,
      highlights: { num_sentences: 3 },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Exa search error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    success: true,
    query,
    results: data.results?.map((r: { title: string; url: string; highlight: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.highlight || "",
    })) || [],
  };
}

// ============================================
// Exa AI: get page content
// ============================================
async function exaGetContents(urls: string[]) {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error("EXA_API_KEY not configured");
  }

  const response = await fetch("https://api.exa.ai/contents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      urls,
      highlights: { num_sentences: 10 },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Exa contents error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    success: true,
    results: data.results?.map((r: { url: string; title: string; highlight: string }) => ({
      url: r.url,
      title: r.title,
      content: r.highlight || "",
    })) || [],
  };
}

// ============================================
// All Metis Tools
// ============================================
export const metisTools = {
  // Calculator: math operations
  calculator: tool({
    description:
      "Perform mathematical calculations. Supports: +, -, *, /, %, parentheses, decimals. " +
      "Use for: revenue calculations, percentages, averages, conversions, growth rates, YoY, MoM, etc.",
    inputSchema: z.object({
      expression: z.string().describe("Mathematical expression to evaluate, e.g., '220491046095 * 0.1' or '(100 - 20) / 100 * 100'"),
      purpose: z.string().describe("What this calculation is for"),
    }),
    execute: async ({ expression, purpose }) => {
      const result = safeEval(expression);
      if (isNaN(result)) {
        return { success: false, purpose, error: "Invalid expression" };
      }
      return { success: true, purpose, expression, result: Number(result.toFixed(2)) };
    },
  }),

  // Web scraping via Firecrawl
  firecrawl_scrape: tool({
    description:
      "Scrape web pages and extract content. Use to: research current prices, product info, " +
      "news, competitor data, or any online information. Returns markdown and HTML content.",
    inputSchema: z.object({
      url: z.string().url().describe("The URL to scrape"),
      prompt: z.string().optional().describe("Specific extraction instructions"),
    }),
    execute: async ({ url, prompt }) => {
      try {
        return await scrapeUrl(url, prompt);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { success: false, url, error: message };
      }
    },
  }),

  // Web search via Exa AI
  exa_search: tool({
    description:
      "Search the web for current information. Use for: finding news, prices, competitor data, " +
      "market research, product reviews, or any information not in the database. Returns title, URL, and snippets.",
    inputSchema: z.object({
      query: z.string().describe("Search query, e.g., 'Zuma sandals Indonesia price 2026'"),
      numResults: z.number().optional().describe("Number of results (default 5, max 10)"),
    }),
    execute: async ({ query, numResults }) => {
      try {
        return await exaSearch(query, numResults);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { success: false, query, error: message };
      }
    },
  }),

  // Get full content from URLs found via exa_search
  exa_get_contents: tool({
    description:
      "Get detailed content from specific URLs. Use after exa_search to get full article content.",
    inputSchema: z.object({
      urls: z.array(z.string().url()).describe("Array of URLs to fetch content from"),
    }),
    execute: async ({ urls }) => {
      try {
        return await exaGetContents(urls);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { success: false, urls, error: message };
      }
    },
  }),

  // Database query (existing)
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
