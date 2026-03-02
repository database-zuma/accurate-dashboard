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

export async function POST(req: Request) {
  const {
    messages,
    dashboardContext,
  }: {
    messages: UIMessage[];
    dashboardContext?: {
      filters?: Record<string, unknown>;
      visibleData?: Record<string, unknown>;
      activeTab?: string;
    };
  } = await req.json();

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
