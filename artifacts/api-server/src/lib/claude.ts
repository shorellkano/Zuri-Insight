import Anthropic from "@anthropic-ai/sdk";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

export async function claudeComplete(system: string, user: string, maxTokens = 2000): Promise<string> {
  const anthropic = getClient();
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = msg.content[0];
  if (block.type !== "text") throw new Error("Unexpected Claude response type");
  return block.text;
}

export async function claudeJSON<T = any>(system: string, user: string, maxTokens = 2000): Promise<T> {
  const raw = await claudeComplete(system, user, maxTokens);
  const clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(clean) as T;
}
