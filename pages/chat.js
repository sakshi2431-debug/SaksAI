import { useState } from "react";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Ask me about my projects, skills, or experience." }
  ]);
  const [loading, setLoading] = useState(false);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;

    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q })
      });

      const data = await res.json();

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: data?.answer || "No answer returned.",
          bullets: Array.isArray(data?.bullets) ? data.bullets : [],
          sources: Array.isArray(data?.sources) ? data.sources : [],
          followUps: Array.isArray(data?.followUps) ? data.followUps : []
        }
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Request failed. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.title}>Ask my portfolio</div>
          <div style={styles.subtitle}>Searches my case notes + links sources</div>
        </div>

        <div style={styles.thread}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                ...styles.msg,
                ...(m.role === "user" ? styles.user : styles.assistant)
              }}
            >
              <div style={styles.msgText}>{m.text}</div>

              {m.role === "assistant" && m.bullets?.length > 0 && (
                <ul style={styles.bullets}>
                  {m.bullets.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              )}

              {m.role === "assistant" && m.sources?.length > 0 && (
                <div style={styles.sources}>
                  <div style={styles.sourcesLabel}>Sources</div>
                  <ul style={styles.sourceList}>
                    {m.sources.map((s, idx) => (
                      <li key={idx}>
                        <a href={s.url} target="_blank" rel="noreferrer" style={styles.link}>
                          {s.title}{s.section ? ` — ${s.section}` : ""}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {m.role === "assistant" && m.followUps?.length > 0 && (
                <div style={styles.chips}>
                  {m.followUps.map((t, idx) => (
                    <button key={idx} style={styles.chip} onClick={() => setInput(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={styles.inputRow}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask something… (e.g., What did you do on ERbuddy?)"
            style={styles.input}
          />
          <button onClick={send} disabled={loading} style={{ ...styles.button, opacity: loading ? 0.6 : 1 }}>
            {loading ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    padding: 24,
    background: "#0b0b0f",
    color: "white",
    fontFamily: "ui-sans-serif, system-ui, -apple-system"
  },
  card: {
    width: "100%",
    maxWidth: 820,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    overflow: "hidden"
  },
  header: { padding: 16, borderBottom: "1px solid rgba(255,255,255,0.10)" },
  title: { fontSize: 18, fontWeight: 700 },
  subtitle: { fontSize: 13, opacity: 0.75, marginTop: 4 },
  thread: { padding: 16, display: "flex", flexDirection: "column", gap: 12, minHeight: 420 },
  msg: { padding: 12, borderRadius: 12, lineHeight: 1.4, whiteSpace: "pre-wrap" },
  user: { alignSelf: "flex-end", background: "rgba(255,255,255,0.10)", maxWidth: "85%" },
  assistant: { alignSelf: "flex-start", background: "rgba(0,0,0,0.35)", maxWidth: "85%" },
  msgText: {},
  bullets: { marginTop: 10, opacity: 0.95 },
  sources: { marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.10)" },
  sourcesLabel: { fontSize: 12, opacity: 0.7, marginBottom: 6 },
  sourceList: { margin: 0, paddingLeft: 18 },
  link: { color: "white", textDecoration: "underline", opacity: 0.9 },
  chips: { marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" },
  chip: {
    border: "1px solid rgba(255,255,255,0.15)",
    background: "transparent",
    color: "white",
    padding: "6px 10px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 12,
    opacity: 0.9
  },
  inputRow: {
    display: "flex",
    gap: 10,
    padding: 16,
    borderTop: "1px solid rgba(255,255,255,0.10)",
    alignItems: "flex-end"
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    resize: "vertical",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    padding: 12,
    outline: "none"
  },
  button: {
    height: 44,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.10)",
    color: "white",
    cursor: "pointer"
  }
};
