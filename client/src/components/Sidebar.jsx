import { useEffect, useState } from "react";

function relativeTime(date) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, onSearch, open, onClose }) {
  const [query, setQuery] = useState("");

  // Debounced history search
  useEffect(() => {
    const t = setTimeout(() => onSearch(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query, onSearch]);

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-top">
        <button className="new-chat" onClick={onNew}>
          <span aria-hidden>＋</span> New chat
        </button>
        <button className="icon-btn close-sidebar" onClick={onClose} aria-label="Close sidebar">✕</button>
      </div>
      <input
        className="search"
        type="search"
        placeholder="Search chats…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <nav className="thread-list">
        {conversations.length === 0 && (
          <p className="muted empty">{query ? "No chats match your search." : "No conversations yet."}</p>
        )}
        {conversations.map((c) => (
          <div
            key={c._id}
            className={`thread ${c._id === activeId ? "active" : ""}`}
            onClick={() => onSelect(c._id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onSelect(c._id)}
          >
            <div className="thread-text">
              <span className="thread-title">{c.title}</span>
              <span className="thread-meta">
                {relativeTime(c.updatedAt)} · {c.tone[0].toUpperCase() + c.tone.slice(1)}
              </span>
            </div>
            <button
              className="icon-btn delete"
              aria-label="Delete conversation"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c._id);
              }}
            >
              🗑
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}
