import { useEffect, useRef, useState } from "react";

export default function Composer({ onSend, onStop, busy }) {
  const [value, setValue] = useState("");
  const ref = useRef(null);

  // Auto-grow the textarea up to a max height.
  useEffect(() => {
    const el = ref.current;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || busy) return;
    onSend(text);
    setValue("");
  };

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={ref}
        rows={1}
        value={value}
        placeholder="Message the assistant…  (Enter to send, Shift+Enter for newline)"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        autoFocus
      />
      {busy ? (
        <button type="button" className="send stop" onClick={onStop} aria-label="Stop generating">
          ■
        </button>
      ) : (
        <button type="submit" className="send" disabled={!value.trim()} aria-label="Send">
          ↑
        </button>
      )}
    </form>
  );
}
