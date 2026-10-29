# AI Chat Assistant

A real-time chat app: React (Vite) frontend, Node/Express backend, MongoDB persistence and the Google Gemini API (`gemini-3.5-flash-lite` by default) for streaming replies.

## Features

| Requirement | Implementation |
|---|---|
| Chat interface | Scrollable view with separate user/AI bubbles, Markdown rendering (code blocks, tables), auto-scroll that stops when you scroll up |
| Streaming view | Server streams Gemini's tokens over **Server-Sent Events**. The client runs a typewriter (`client/src/lib/useTypewriter.js`) that shows them **one character at a time**, with a blinking cursor |
| History sidebar | Past threads, newest first, with relative time and tone. Click one to reopen it, or delete it |
| API integration | Google Gen AI SDK (`@google/genai`) streaming (`server/src/services/llm.js`) |
| Persistence | MongoDB `Conversation` document → `exchanges[]` of `{ userPrompt, aiResponse, tone, timestamp, stopped }` (`server/src/models/Conversation.js`) |
| **Tone toggle** | Professional / Casual / Concise. The backend adds the chosen tone's modifier to the **system instruction** on every request, so a switch applies to the next reply. Each AI bubble shows a badge with the tone it was written in |

### Extra feature 1: Stop & Regenerate
- **Stop** (■) cancels a reply while it is being written. The client aborts the request, the server sees the disconnect and aborts the upstream Gemini call (so no further tokens are paid for), and the partial answer is saved with `stopped: true`.
- **↻ Regenerate** writes the last reply again, in the tone currently selected. For example, regenerate a long answer as "Concise".

### Extra feature 2: Auto-titled threads + history search
- After the first exchange, Gemini writes a 3–6 word title for the thread. The title is pushed to the sidebar as an SSE `title` event.
- The sidebar search box (debounced) does a case-insensitive search over titles, prompts *and* responses.

Small additions: export a transcript as Markdown (`⤓ Export`), copy a reply, dark mode, mobile layout, and a `MOCK_LLM=1` mode for running without an API key.

## Running locally

Prerequisites: Node 20+, MongoDB on `mongodb://127.0.0.1:27017` (or set `MONGODB_URI`), and a Gemini API key (free at https://aistudio.google.com/apikey).

Create `server/.env`:

```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/ai-chat-assistant
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.5-flash-lite   # any model your key can use
MOCK_LLM=0                           # 1 = canned replies, no key needed
CLIENT_ORIGIN=http://localhost:5173
```

```bash
# 1. Backend
cd server
npm install
npm run dev                 # http://localhost:4000 (reads .env)

# 2. Frontend (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173  (proxies /api → :4000)
```

Production: `cd client && npm run build`, then `cd server && npm start`. Express serves `client/dist` at http://localhost:4000.

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/chat` | Body `{ conversationId?, message, tone, regenerate? }`. Streams SSE events `meta → delta* → done → title?` (or `error`) |
| `GET` | `/api/conversations?q=` | List or search threads |
| `GET` | `/api/conversations/:id` | Full thread |
| `PATCH` | `/api/conversations/:id` | Rename `{ title }` |
| `DELETE` | `/api/conversations/:id` | Delete thread |
| `GET` | `/api/conversations/:id/export?format=md\|json` | Download transcript |
| `GET` | `/api/health` | DB / mock status |

## Notes on the Gemini integration
- The tone is sent as Gemini's `systemInstruction` (base prompt + tone modifier) on every request.
- Conversation history is rebuilt from MongoDB on every turn (`user`/`model` roles), so the model sees the whole thread.
- Requests time out after 60s with one retry, so an overloaded model shows an error instead of hanging. If you get "high demand" errors, set `GEMINI_MODEL` to another model your key can use.
- The server prefers IPv4 (`dns.setDefaultResultOrder("ipv4first")`) because some networks advertise IPv6 but can't route it.
- **macOS + iCloud:** if the project is inside an iCloud-synced `Documents` folder, iCloud can offload files and Node will hang. `node_modules` is kept in `node_modules.nosync` (symlinked) so iCloud skips it. Moving the project outside `Documents` avoids the problem entirely.
