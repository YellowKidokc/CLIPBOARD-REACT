/**
 * Which AI the app talks to. DeepSeek, Ollama and OpenAI all speak the OpenAI chat API, so one
 * client works for all three; this picks the endpoint, key and model from environment settings.
 *
 *   AI_PROVIDER = deepseek | ollama | openai   (unset: the first one that has a key or host)
 *   AI_MODEL    = overrides the provider's default model
 *   DEEPSEEK_API_KEY, OPENAI_API_KEY, OLLAMA_HOST (e.g. http://192.168.1.50:11434)
 */
export type AiProvider = "deepseek" | "ollama" | "openai";

export interface AiConfig {
  provider: AiProvider;
  baseURL: string;
  apiKey: string;
  model: string;
}

type Env = Record<string, string | undefined>;

const DEFAULT_MODEL: Record<AiProvider, string> = {
  deepseek: "deepseek-chat",
  ollama: "gemma4:e4b",
  openai: "gpt-4o-mini",
};

function configFor(provider: AiProvider, env: Env): AiConfig | null {
  const model = env.AI_MODEL?.trim() || DEFAULT_MODEL[provider];
  switch (provider) {
    case "deepseek":
      return env.DEEPSEEK_API_KEY ? { provider, baseURL: "https://api.deepseek.com/v1", apiKey: env.DEEPSEEK_API_KEY, model } : null;
    case "openai":
      return env.OPENAI_API_KEY ? { provider, baseURL: "https://api.openai.com/v1", apiKey: env.OPENAI_API_KEY, model } : null;
    case "ollama": {
      const host = env.OLLAMA_HOST?.trim().replace(/\/+$/, "");
      if (!host) return null;
      const base = /^https?:\/\//.test(host) ? host : `http://${host}`;
      // Ollama ignores the key, but the OpenAI client requires a non-empty one.
      return { provider, baseURL: `${base}/v1`, apiKey: "ollama", model };
    }
  }
}

/** The configured AI, or null when none is set up (AI features then return a clear error). */
export function resolveAiConfig(env: Env): AiConfig | null {
  const wanted = env.AI_PROVIDER?.trim().toLowerCase();
  if (wanted) {
    if (wanted !== "deepseek" && wanted !== "ollama" && wanted !== "openai") {
      throw new Error(`AI_PROVIDER must be deepseek, ollama or openai (got "${env.AI_PROVIDER}")`);
    }
    return configFor(wanted, env);
  }
  for (const p of ["deepseek", "ollama", "openai"] as const) {
    const config = configFor(p, env);
    if (config) return config;
  }
  return null;
}

export const NO_AI_MESSAGE =
  "No AI provider configured: set DEEPSEEK_API_KEY, OLLAMA_HOST or OPENAI_API_KEY (and optionally AI_PROVIDER / AI_MODEL).";
