import { Router } from "express";
import mongoose from "mongoose";
import { Conversation, TONES } from "../models/Conversation.js";
import { streamReply, generateTitle } from "../services/llm.js";

const router = Router();

/**
 * POST /api/chat  (Server-Sent Events response)
 * body: { conversationId?, message?, tone, regenerate? }
 *
 * Events:  meta {conversationId, exchangeId} → delta {text}* → done {exchange} → title {title}?
 *          error {message}
 */
router.post("/", async (req, res) => {
  const { conversationId, message, regenerate = false } = req.body ?? {};
  const tone = TONES.includes(req.body?.tone) ? req.body.tone : "professional";

  if (!regenerate && (typeof message !== "string" || !message.trim())) {
    return res.status(400).json({ error: "message is required" });
  }

  let convo;
  if (conversationId) {
    if (!mongoose.isValidObjectId(conversationId)) return res.status(404).json({ error: "Conversation not found" });
    convo = await Conversation.findById(conversationId);
    if (!convo) return res.status(404).json({ error: "Conversation not found" });
  } else if (regenerate) {
    return res.status(400).json({ error: "conversationId is required to regenerate" });
  } else {
    convo = new Conversation({ tone });
  }

  let exchange;
  if (regenerate) {
    exchange = convo.exchanges.at(-1);
    if (!exchange) return res.status(400).json({ error: "Nothing to regenerate" });
    exchange.aiResponse = "";
    exchange.stopped = false;
    exchange.tone = tone;
    exchange.timestamp = new Date();
  } else {
    convo.exchanges.push({ userPrompt: message.trim(), tone });
    exchange = convo.exchanges.at(-1);
  }
  convo.tone = tone;
  await convo.save(); // persist the prompt right away

  // --- SSE setup ---
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  // Client pressed Stop / closed the tab → abort the upstream API call.
  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) abort.abort();
  });

  send("meta", { conversationId: convo._id, exchangeId: exchange._id });

  const history = convo.exchanges.slice(0, -1);
  let text = "";
  let failed = null;
  try {
    await streamReply({
      exchanges: history,
      prompt: exchange.userPrompt,
      tone,
      signal: abort.signal,
      onText: (delta) => {
        text += delta;
        send("delta", { text: delta });
      },
    });
  } catch (err) {
    if (!abort.signal.aborted) {
      failed = err;
      console.error("LLM error:", err);
    }
  }

  exchange.aiResponse = text;
  exchange.stopped = abort.signal.aborted;
  await convo.save();

  if (abort.signal.aborted) return; // client is gone; partial reply saved

  if (failed) {
    send("error", { message: friendlyError(failed) });
    return res.end();
  }

  send("done", { exchange: exchange.toObject() });

  // Auto-title after the first completed exchange.
  if (convo.exchanges.length === 1 && convo.title === "New chat" && text) {
    try {
      const title = await generateTitle(exchange.userPrompt, text);
      if (title) {
        convo.title = title;
        await convo.save();
        send("title", { title });
      }
    } catch (err) {
      console.error("Title generation failed:", err.message);
    }
  }
  res.end();
});

function friendlyError(err) {
  const status = err?.status ?? err?.code;
  if (status === 400 && /api key/i.test(err.message)) return "The server's Gemini API key is invalid.";
  if (status === 401 || status === 403) return "The server's Gemini API key is missing or not authorized.";
  if (status === 404) return "The configured GEMINI_MODEL was not found.";
  if (status === 429) return "Rate limited / quota exceeded on the Gemini API — please retry in a moment.";
  if (status >= 500) return "The AI provider had a temporary problem — please retry.";
  if (/api key/i.test(err?.message ?? "")) return "No Gemini API key configured (set GEMINI_API_KEY or MOCK_LLM=1).";
  if (err?.message === "fetch failed") return "Couldn't reach the Gemini API — check the server's internet connection.";
  return "Something went wrong generating a response.";
}

export default router;
