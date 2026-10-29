import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const MOCK = process.env.MOCK_LLM === "1";

const ai = MOCK ? null : new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      // Fail fast instead of hanging when the model is overloaded (503s).
      httpOptions: { timeout: 60_000, retryOptions: { attempts: 2 } },
    });

const BASE_SYSTEM =
  "You are a helpful, accurate AI assistant in a chat app. " +
  "Format answers with Markdown when it helps readability (lists, code blocks).";

// The "Tone Toggle": appended to the system instruction on every request,
// so switching tone takes effect on the very next message.
const TONE_MODIFIERS = {
  professional:
    "Tone: professional. Write in a clear, polished, business-appropriate voice. " +
    "Be precise and well-structured; avoid slang, jokes and emoji.",
  casual:
    "Tone: casual. Write like a friendly, relaxed colleague. Use plain, conversational " +
    "language and contractions; light humor is fine.",
  concise:
    "Tone: concise. Give the shortest complete answer: lead with the answer, " +
    "use at most a few sentences or a short list, and skip preamble and pleasantries.",
};

export function buildSystemPrompt(tone) {
  return `${BASE_SYSTEM}\n\n${TONE_MODIFIERS[tone] ?? TONE_MODIFIERS.professional}`;
}

// Turn stored exchanges into Gemini `contents` (roles: "user" / "model").
export function toContents(exchanges, nextPrompt) {
  const contents = [];
  for (const ex of exchanges) {
    if (!ex.aiResponse) continue; // skip turns with no answer so roles keep alternating
    contents.push({ role: "user", parts: [{ text: ex.userPrompt }] });
    contents.push({ role: "model", parts: [{ text: ex.aiResponse }] });
  }
  contents.push({ role: "user", parts: [{ text: nextPrompt }] });
  return contents;
}

/**
 * Stream a reply. Calls onText(delta) for each text chunk; resolves when done.
 * Aborts when `signal` fires (user pressed Stop or closed the tab).
 */
export async function streamReply({ exchanges, prompt, tone, signal, onText }) {
  if (MOCK) return mockStream({ prompt, tone, signal, onText });

  const stream = await ai.models.generateContentStream({
    model: MODEL,
    contents: toContents(exchanges, prompt),
    config: {
      systemInstruction: buildSystemPrompt(tone),
      abortSignal: signal,
    },
  });

  let finishReason;
  for await (const chunk of stream) {
    if (signal.aborted) break;
    if (chunk.text) onText(chunk.text);
    finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
  }
  return { stopReason: finishReason };
}

// Short title for the history sidebar, generated after the first exchange.
export async function generateTitle(prompt, response) {
  if (MOCK) return prompt.split(/\s+/).slice(0, 6).join(" ").replace(/[?.!,]+$/, "");

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: `User: ${prompt.slice(0, 2000)}\n\nAssistant: ${response.slice(0, 2000)}`,
    config: {
      systemInstruction:
        "Write a 3-6 word title summarizing this chat. Reply with the title only: " +
        "no quotes, no trailing punctuation.",
    },
  });
  const text = res.text?.trim();
  return text ? text.replace(/^["'*]+|["'*]+$/g, "").split("\n")[0].slice(0, 80) : null;
}

async function mockStream({ prompt, tone, signal, onText }) {
  const replies = {
    professional: `Thank you for your question. Regarding "${prompt}", here is a structured overview:\n\n1. **Context** – this is a mock response used while \`MOCK_LLM=1\`.\n2. **Recommendation** – set \`GEMINI_API_KEY\` to receive real answers.\n\nPlease let me know if you require further detail.`,
    casual: `Hey! So about "${prompt}" — this is just a mock reply since \`MOCK_LLM=1\` is on 😄 Drop in an API key and I'll give you the real deal.`,
    concise: `Mock reply (MOCK_LLM=1). Set GEMINI_API_KEY for real answers.`,
  };
  const text = replies[tone] ?? replies.professional;
  for (const chunk of text.match(/.{1,6}/gs)) {
    if (signal.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
    onText(chunk);
    await new Promise((r) => setTimeout(r, 30));
  }
  return { stopReason: "STOP" };
}
