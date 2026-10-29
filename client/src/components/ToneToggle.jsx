const TONES = [
  { id: "professional", label: "Professional", icon: "💼" },
  { id: "casual", label: "Casual", icon: "😎" },
  { id: "concise", label: "Concise", icon: "⚡" },
];

export default function ToneToggle({ value, onChange, disabled }) {
  return (
    <div className="tone-toggle" role="radiogroup" aria-label="Response tone">
      {TONES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={value === t.id}
          className={value === t.id ? "selected" : ""}
          onClick={() => onChange(t.id)}
          disabled={disabled}
          title={`${t.label} tone`}
        >
          <span aria-hidden>{t.icon}</span>
          <span className="tone-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
