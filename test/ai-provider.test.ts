import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAiConfig } from "../shared/ai-provider";

test("explicit providers", () => {
  assert.deepEqual(resolveAiConfig({ AI_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "sk-d" }), {
    provider: "deepseek", baseURL: "https://api.deepseek.com/v1", apiKey: "sk-d", model: "deepseek-chat",
  });
  assert.deepEqual(resolveAiConfig({ AI_PROVIDER: "Ollama", OLLAMA_HOST: "192.168.1.50:11434/" }), {
    provider: "ollama", baseURL: "http://192.168.1.50:11434/v1", apiKey: "ollama", model: "gemma4:e4b",
  });
  assert.equal(resolveAiConfig({ AI_PROVIDER: "ollama", OLLAMA_HOST: "http://pc:11434", AI_MODEL: "qwen3:8b" })?.model, "qwen3:8b");
  assert.equal(resolveAiConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-o" })?.model, "gpt-4o-mini");
});

test("explicit provider without its key is not configured, and never falls back to another", () => {
  assert.equal(resolveAiConfig({ AI_PROVIDER: "deepseek", OPENAI_API_KEY: "sk-o" }), null);
  assert.throws(() => resolveAiConfig({ AI_PROVIDER: "grok" }), /deepseek, ollama or openai/);
});

test("auto-detect order: deepseek, then ollama, then openai", () => {
  assert.equal(resolveAiConfig({ OPENAI_API_KEY: "o", OLLAMA_HOST: "pc:11434", DEEPSEEK_API_KEY: "d" })?.provider, "deepseek");
  assert.equal(resolveAiConfig({ OPENAI_API_KEY: "o", OLLAMA_HOST: "pc:11434" })?.provider, "ollama");
  assert.equal(resolveAiConfig({ OPENAI_API_KEY: "o" })?.provider, "openai");
  assert.equal(resolveAiConfig({}), null);
});
