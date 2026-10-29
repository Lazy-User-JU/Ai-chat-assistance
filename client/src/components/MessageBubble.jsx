import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function UserBubble({ text, timestamp }) {
  return (
    <div className="row user">
      <div className="bubble user-bubble">
        <p className="plain">{text}</p>
        {timestamp && <time>{new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>}
      </div>
    </div>
  );
}

export function AiBubble({ text, tone, streaming, stopped, error, canRegenerate, onRegenerate }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="row ai">
      <div className="avatar" aria-hidden>✦</div>
      <div className={`bubble ai-bubble ${streaming ? "streaming" : ""}`}>
        {text ? (
          <div className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        ) : streaming ? (
          <div className="typing" aria-label="Assistant is typing"><span /><span /><span /></div>
        ) : null}
        {streaming && text && <span className="cursor" aria-hidden />}
        {error && <p className="error-text">⚠ {error}</p>}
        {!streaming && (
          <div className="bubble-actions">
            {tone && <span className="tone-badge">{tone}</span>}
            {stopped && <span className="stopped-badge">stopped</span>}
            {text && (
              <button className="link-btn" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
            )}
            {canRegenerate && (
              <button className="link-btn" onClick={onRegenerate}>↻ Regenerate</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
