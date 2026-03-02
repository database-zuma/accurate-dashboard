/**
 * Metis AI — Model Configuration
 * Models are tried in order. If one fails, next is used automatically.
 * All models MUST support tool/function calling for queryDatabase.
 *
 * Provider: MiniMax.io (Coding Plan)
 * Base URL: https://api.minimax.io/v1 (OpenAI-compatible)
 * Models: MiniMax-M2.5 (primary), MiniMax-M2.1 (fallback), MiniMax-M2.1-highspeed (last resort)
 */
export const METIS_MODELS = [
  {
    id: "MiniMax-M2.5",
    name: "MiniMax M2.5",
    provider: "MiniMax",
    free: false,
  },
  {
    id: "MiniMax-M2.1",
    name: "MiniMax M2.1",
    provider: "MiniMax",
    free: false,
  },
  {
    id: "MiniMax-M2.1-highspeed",
    name: "MiniMax M2.1 Highspeed",
    provider: "MiniMax",
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
