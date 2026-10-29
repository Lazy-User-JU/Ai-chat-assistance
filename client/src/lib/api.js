async function json(res) {
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res.status === 204 ? null : res.json();
}

export const api = {
  listConversations: (q = "") =>
    fetch(`/api/conversations${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(json),
  getConversation: (id) => fetch(`/api/conversations/${id}`).then(json),
  deleteConversation: (id) => fetch(`/api/conversations/${id}`, { method: "DELETE" }).then(json),
  renameConversation: (id, title) =>
    fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).then(json),
  exportUrl: (id, format = "md") => `/api/conversations/${id}/export?format=${format}`,
};

/**
 * POST /api/chat and parse the Server-Sent Events stream.
 * handlers: { meta, delta, done, title, error } – each receives the event's JSON payload.
 */
export async function streamChat(body, handlers, signal) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Request failed (${res.status})`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let sep;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = "message";
      let data = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) handlers[event]?.(JSON.parse(data));
    }
  }
}
