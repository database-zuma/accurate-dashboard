import {
  streamText,
  type UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { buildSystemPrompt } from "@/lib/metis/system-prompt";
import { metisTools } from "@/lib/metis/tools";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export async function POST(req: Request) {
  const { messages, dashboardContext }: {
    messages: UIMessage[];
    dashboardContext?: {
      filters?: Record<string, unknown>;
      visibleData?: Record<string, unknown>;
      activeTab?: string;
    };
  } = await req.json();

  const result = streamText({
    model: openrouter("moonshotai/kimi-k2.5"),
    system: buildSystemPrompt(dashboardContext),
    messages: await convertToModelMessages(messages),
    tools: metisTools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
