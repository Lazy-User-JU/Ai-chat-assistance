import { Router } from "express";
import mongoose from "mongoose";
import { Conversation } from "../models/Conversation.js";

const router = Router();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/conversations?q=search  – sidebar list, newest first
router.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const filter = {};
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ title: re }, { "exchanges.userPrompt": re }, { "exchanges.aiResponse": re }];
  }
  const convos = await Conversation.find(filter)
    .sort({ updatedAt: -1 })
    .limit(100)
    .select("title tone updatedAt createdAt")
    .lean();
  res.json(convos);
});

router.get("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Not found" });
  const convo = await Conversation.findById(req.params.id).lean();
  if (!convo) return res.status(404).json({ error: "Not found" });
  res.json(convo);
});

router.patch("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Not found" });
  const update = {};
  if (typeof req.body.title === "string" && req.body.title.trim()) update.title = req.body.title.trim().slice(0, 80);
  const convo = await Conversation.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
  if (!convo) return res.status(404).json({ error: "Not found" });
  res.json(convo);
});

router.delete("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Not found" });
  await Conversation.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

// GET /api/conversations/:id/export?format=md|json – download a transcript
router.get("/:id/export", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Not found" });
  const convo = await Conversation.findById(req.params.id).lean();
  if (!convo) return res.status(404).json({ error: "Not found" });
  const safeName = convo.title.replace(/[^\w\- ]+/g, "").trim() || "chat";

  if (req.query.format === "json") {
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.json"`);
    return res.json(convo);
  }
  const md = [
    `# ${convo.title}`,
    "",
    ...convo.exchanges.flatMap((ex) => [
      `### You · ${new Date(ex.timestamp).toLocaleString()}`,
      "",
      ex.userPrompt,
      "",
      `### Assistant (${ex.tone})`,
      "",
      ex.aiResponse || "_(no response)_",
      "",
    ]),
  ].join("\n");
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}.md"`);
  res.send(md);
});

export default router;
