import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import ToneToggle from "./components/ToneToggle.jsx";
import Composer from "./components/Composer.jsx";
import { AiBubble, UserBubble } from "./components/MessageBubble.jsx";
import { api, streamChat } from "./lib/api.js";
import { useTypewriter } from "./lib/useTypewriter.js";

const SUGGESTIONS = [
  "Explain how HTTPS works",
  "Write a haiku about debugging",
  "Give me 3 tips for a job interview",
  "What's the difference between SQL and NoSQL?",
];

const withKey = (ex) => ({ ...ex, key: ex._id });

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [exchanges, setExchanges] = useState([]);
  const [tone, setTone] = useState("professional");
  const [stream, setStream] = useState(null); // { key, target, done, aborted }
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [health, setHealth] = useState(null);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);

  const typed = useTypewriter(stream?.target ?? "", !!stream);
  const busy = !!stream;

  const refreshList = useCallback(
    (q = search) => api.listConversations(q).then(setConversations).catch(() => {}),
    [search]
  );

  useEffect(() => {
    refreshList(search);
  }, [search, refreshList]);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth({ ok: false }));
  }, []);

  const patchExchange = (key, patch) =>
    setExchanges((list) => list.map((e) => (e.key === key ? { ...e, ...patch } : e)));

  // Once the server is done AND the typewriter has caught up, commit the reply.
  useEffect(() => {
    if (stream?.done && (typed.caughtUp || stream.aborted)) {
      patchExchange(stream.key, { aiResponse: stream.target });
      setStream(null);
    }
  }, [stream, typed.caughtUp]);

  // Keep the view pinned to the newest message unless the user scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [exchanges, typed.text]);

  const onScroll = () => {
    const el = scrollRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const stop = () => abortRef.current?.abort();

  async function send(text, { regenerate = false } = {}) {
    if (busy) return;
    stickToBottom.current = true;
    const key = regenerate ? exchanges.at(-1).key : crypto.randomUUID();
    if (regenerate) {
      patchExchange(key, { aiResponse: "", stopped: false, error: null, tone });
    } else {
      setExchanges((list) => [
        ...list,
        { key, userPrompt: text, aiResponse: "", tone, timestamp: new Date().toISOString() },
      ]);
    }
    setStream({ key, target: "", done: false, aborted: false });

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let aborted = false;
    try {
      await streamChat(
        { conversationId: activeId, message: text, tone, regenerate },
        {
          meta: ({ conversationId, exchangeId }) => {
            setActiveId(conversationId);
            patchExchange(key, { _id: exchangeId });
          },
          delta: ({ text: d }) => setStream((s) => ({ ...s, target: s.target + d })),
          done: ({ exchange }) => patchExchange(key, { timestamp: exchange.timestamp }),
          title: () => refreshList(),
          error: ({ message }) => patchExchange(key, { error: message }),
        },
        ctrl.signal
      );
    } catch (err) {
      if (err.name === "AbortError") {
        aborted = true;
        patchExchange(key, { stopped: true });
      } else {
        patchExchange(key, { error: err.message });
      }
    }
    setStream((s) => (s ? { ...s, done: true, aborted } : s));
    refreshList();
  }

  async function openConversation(id) {
    stop();
    setSidebarOpen(false);
    try {
      const convo = await api.getConversation(id);
      setActiveId(convo._id);
      setExchanges(convo.exchanges.map(withKey));
      setTone(convo.tone);
      stickToBottom.current = true;
    } catch {
      refreshList();
    }
  }

  function newChat() {
    stop();
    setActiveId(null);
    setExchanges([]);
    setSidebarOpen(false);
  }

  async function deleteConversation(id) {
    await api.deleteConversation(id);
    if (id === activeId) newChat();
    refreshList();
  }

  const activeTitle = conversations.find((c) => c._id === activeId)?.title ?? "New chat";

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={openConversation}
        onNew={newChat}
        onDelete={deleteConversation}
        onSearch={setSearch}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}

      <main className="chat">
        <header className="chat-header">
          <button className="icon-btn menu" onClick={() => setSidebarOpen(true)} aria-label="Open history">☰</button>
          <h1 title={activeTitle}>{activeTitle}</h1>
          {activeId && (
            <a className="link-btn export" href={api.exportUrl(activeId)} title="Download transcript as Markdown">
              ⤓ Export
            </a>
          )}
          <ToneToggle value={tone} onChange={setTone} disabled={busy} />
        </header>

        {health && (!health.ok || !health.db || health.mock) && (
          <div className="banner">
            {!health.ok || !health.db
              ? "Backend or MongoDB is unreachable — start the server and MongoDB."
              : "Mock mode (MOCK_LLM=1): replies are canned. Set ANTHROPIC_API_KEY for real answers."}
          </div>
        )}

        <div className="messages" ref={scrollRef} onScroll={onScroll}>
          {exchanges.length === 0 ? (
            <div className="empty-state">
              <div className="logo" aria-hidden>✦</div>
              <h2>How can I help today?</h2>
              <p className="muted">Pick a tone above — it changes the style of the very next reply.</p>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            exchanges.map((ex, i) => {
              const isStreaming = stream?.key === ex.key;
              const isLast = i === exchanges.length - 1;
              return (
                <div key={ex.key} className="exchange">
                  <UserBubble text={ex.userPrompt} timestamp={ex.timestamp} />
                  <AiBubble
                    text={isStreaming ? typed.text : ex.aiResponse}
                    tone={ex.tone}
                    streaming={isStreaming}
                    stopped={ex.stopped}
                    error={ex.error}
                    canRegenerate={isLast && !busy && !!activeId}
                    onRegenerate={() => send(ex.userPrompt, { regenerate: true })}
                  />
                </div>
              );
            })
          )}
        </div>

        <Composer onSend={send} onStop={stop} busy={busy} />
      </main>
    </div>
  );
}
