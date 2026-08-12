import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  appName: process.env.OPENROUTER_APP_NAME,
  appUrl: process.env.OPENROUTER_SITE_URL,
});

const CHAT_MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-opus-5";
const EMBEDDING_MODEL =
  process.env.OPENROUTER_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";

export const chatModel = openrouter(CHAT_MODEL);
export const embeddingModel = openrouter.textEmbeddingModel(EMBEDDING_MODEL);
