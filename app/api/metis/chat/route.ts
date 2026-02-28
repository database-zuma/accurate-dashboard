import {
  streamText,
  type UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { buildSystemPrompt } from "@/lib/metis/system-prompt";
import { metisTools } from "@/lib/metis/tools";
import { METIS_MODELS } from "@/lib/metis/config";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
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
        model: openrouter(model.id),
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
