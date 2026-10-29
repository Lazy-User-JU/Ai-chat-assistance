import dns from "node:dns";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chatRouter from "./routes/chat.js";
import conversationsRouter from "./routes/conversations.js";

// Some networks advertise IPv6 but can't route it; try IPv4 first for API calls.
dns.setDefaultResultOrder("ipv4first");

const PORT = Number(process.env.PORT ?? 4000);
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/ai-chat-assistant";

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, db: mongoose.connection.readyState === 1, mock: process.env.MOCK_LLM === "1" })
);
app.use("/api/chat", chatRouter);
app.use("/api/conversations", conversationsRouter);

// Serve the built client in production (npm run build in /client).
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (_req, res, next) =>
  res.sendFile(path.join(clientDist, "index.html"), (err) => err && next())
);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
});

await mongoose.connect(MONGODB_URI);
console.log(`MongoDB connected: ${MONGODB_URI}`);
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
