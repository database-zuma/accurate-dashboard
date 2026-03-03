import {
  streamText,
  type UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { buildSystemPrompt } from "@/lib/metis/system-prompt";
import { metisTools } from "@/lib/metis/tools";
import { METIS_MODELS } from "@/lib/metis/config";

const minimax = createOpenAI({
  apiKey: process.env.MINIMAX_API_KEY!,
  baseURL: "https://api.minimax.io/v1",
});

/**
 * Normalize messages to ensure UIMessage format with `parts` array.
 * The AI SDK v6 `convertToModelMessages` requires `parts` on every message.
 * Messages from the frontend useChat hook already have `parts`,
 * but edge cases (first load, serialization) may strip them.
 */
function normalizeMessages(raw: unknown[]): UIMessage[] {
  return raw.map((msg: Record<string, unknown>, i: number) => {
    // Already has parts — pass through
    if (Array.isArray(msg.parts) && msg.parts.length > 0) {
      return msg as unknown as UIMessage;
    }
    // Build parts from content string (fallback)
    const content = typeof msg.content === "string" ? msg.content : "";
    return {
      id: (msg.id as string) || `msg-${i}`,
      role: (msg.role as UIMessage["role"]) || "user",
      parts: [{ type: "text" as const, text: content }],
    } as UIMessage;
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const rawMessages: unknown[] = body.messages ?? [];
  const dashboardContext: {
    filters?: Record<string, unknown>;
    visibleData?: Record<string, unknown>;
    activeTab?: string;
  } | undefined = body.dashboardContext;

  if (!rawMessages.length) {
    return Response.json({ error: "No messages provided" }, { status: 400 });
  }

  const messages = normalizeMessages(rawMessages);
  const system = buildSystemPrompt(dashboardContext);
  const modelMessages = await convertToModelMessages(messages);
  let lastError: unknown;

  for (const model of METIS_MODELS) {
    try {
      const result = streamText({
        model: minimax.chat(model.id),
        system,
        messages: modelMessages,
        tools: metisTools,
        stopWhen: stepCountIs(3),
        onError({ error }) {
          console.error(`[Metis] Stream error from ${model.id}:`, error);
        },
      });

      const streamResponse = result.toUIMessageStreamResponse();

      return new Response(streamResponse.body, {
        status: streamResponse.status,
        headers: new Headers({
          ...Object.fromEntries(streamResponse.headers.entries()),
          "X-Metis-Model": model.name,
        }),
      });
    } catch (err) {
      lastError = err;
      console.error(`[Metis] Model ${model.id} failed, trying next...`, err);
    }
  }

  return Response.json(
    { error: "All models unavailable", detail: String(lastError) },
    { status: 503 }
  );
}
