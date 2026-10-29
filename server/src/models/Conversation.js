import mongoose from "mongoose";

export const TONES = ["professional", "casual", "concise"];

// One exchange = one user prompt and the AI response to it.
const exchangeSchema = new mongoose.Schema(
  {
    userPrompt: { type: String, required: true },
    aiResponse: { type: String, default: "" },
    tone: { type: String, enum: TONES, default: "professional" },
    timestamp: { type: Date, default: Date.now },
    // true when the user pressed "Stop" before the response finished
    stopped: { type: Boolean, default: false },
  },
  { _id: true }
);

const conversationSchema = new mongoose.Schema(
  {
    title: { type: String, default: "New chat" },
    tone: { type: String, enum: TONES, default: "professional" },
    exchanges: { type: [exchangeSchema], default: [] },
  },
  { timestamps: true }
);

conversationSchema.index({ updatedAt: -1 });

export const Conversation = mongoose.model("Conversation", conversationSchema);
