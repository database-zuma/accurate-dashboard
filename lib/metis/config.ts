/**
 * Metis AI — Model Configuration
 * Models are tried in order. If one fails, next is used automatically.
 * ALL models MUST be free tier on OpenRouter (`:free` suffix).
 * ALL models MUST support tool/function calling for queryDatabase.
 */
export const METIS_MODELS = [
  {
    id: "google/gemini-2.0-flash-exp:free",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    free: true,
  },
  {
    id: "nvidia/llama-3.1-nemotron-70b-instruct:free",
    name: "Nemotron 70B",
    provider: "NVIDIA",
    free: true,
  },
  {
    id: "qwen/qwen3-30b-a3b:free",
    name: "Qwen3 30B",
    provider: "Alibaba",
    free: true,
  },
  {
    id: "meta-llama/llama-3.1-8b-instruct:free",
    name: "Llama 3.1 8B",
    provider: "Meta",
    free: true,
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
