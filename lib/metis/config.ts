/**
 * Metis AI — Model Configuration
 * Models are tried in order. If one fails, next is used automatically.
 * All models MUST support tool/function calling for queryDatabase.
 *
 * NOTE: OpenRouter free tier (:free) does NOT support tool calling.
 * Using ultra-cheap paid models instead (~$0.0005/query = $0.50 per 1000 queries).
 */
export const METIS_MODELS = [
  {
    id: "deepseek/deepseek-chat-v3-0324",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    free: false,
  },
  {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    free: false,
  },
  {
    id: "qwen/qwen3-235b-a22b",
    name: "Qwen3 235B",
    provider: "Alibaba",
    free: false,
  },
] as const;

export type MetisModel = (typeof METIS_MODELS)[number];

export const PRIMARY_MODEL = METIS_MODELS[0];

/** Get display name from full model ID (fallback-safe) */
export function getModelDisplayName(modelId: string): string {
  const found = METIS_MODELS.find((m) => m.id === modelId);
  if (found) return found.name;
  // Extract last segment: "org/model-name:variant" → "model-name"
  return modelId.split("/").pop()?.split(":")[0] ?? modelId;
}
