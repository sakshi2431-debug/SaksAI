import Head from "next/head";
import { useState } from "react";

const TOPICS = [
  { label: "My Projects" },
  { label: "Design Process" },
  { label: "Skills" },
  { label: "Experience" },
  { label: "For Recruiters", icon: "💼" }
];

const SUGGESTIONS = [
  "Tell me about yourself",
  "What are you working on?",
  "Show me your best project"
];

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const started = messages.length > 0;

  async function send(overrideText) {
    const q = (overrideText ?? input).trim();
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

      if (!res.ok) throw new Error("Chat unavailable");
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
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Chat with Sakshi's AI</div>
            <div style={styles.subtitle}>Ask anything about my work, skills, or experience</div>
          </div>
          <button style={styles.closeButton} aria-label="Close">×</button>
        </div>

        <div style={styles.topics}>
          {TOPICS.map((t, i) => (
            <button
              key={t.label}
              style={{ ...styles.topicPill, ...(i === TOPICS.length - 1 ? styles.topicPillLast : {}) }}
              onClick={() => send(t.label)}
            >
              {t.icon && <span style={styles.topicIcon}>{t.icon}</span>}
              {t.label}
            </button>
          ))}
        </div>

        <div style={styles.body}>
          {!started && (
            <div>
              <div style={styles.sectionLabel}>Suggestions</div>
              <div style={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} style={styles.suggestionButton} onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {started && (
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
                        <button key={idx} style={styles.chip} onClick={() => send(t)}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {loading && <div style={{ ...styles.msg, ...styles.assistant, ...styles.typing }}>Thinking…</div>}
            </div>
          )}
        </div>

        <div style={styles.inputRow}>
          <span style={styles.inputIcon}>💬</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask me about my work, skills, or experience..."
            style={styles.input}
          />
          <button
            onClick={() => send()}
            disabled={loading}
            style={{ ...styles.sendButton, opacity: loading ? 0.5 : 1 }}
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

const FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, sans-serif";
const NAVY = "#1c2340";
const ACCENT = "#5b7fd1";
const BORDER = "rgba(28, 35, 64, 0.08)";

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    background: "linear-gradient(180deg, #eef1fb 0%, #f7f4ee 60%, #f3eae0 100%)",
    fontFamily: FONT,
    color: NAVY
  },
  card: {
    width: "100%",
    maxWidth: 580,
    borderRadius: 24,
    border: `1px solid ${BORDER}`,
    background: "#ffffff",
    boxShadow: "0 20px 60px rgba(28, 35, 64, 0.12)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    maxHeight: "85vh"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "20px 22px 16px",
    borderBottom: `1px solid ${BORDER}`
  },
  title: { fontSize: 18, fontWeight: 700, color: NAVY, letterSpacing: -0.2 },
  subtitle: { fontSize: 13, color: "rgba(28, 35, 64, 0.55)", marginTop: 4 },
  closeButton: {
    border: "none",
    background: "transparent",
    color: "rgba(28, 35, 64, 0.4)",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
    padding: 4
  },
  topics: {
    display: "flex",
    gap: 8,
    padding: "14px 22px",
    borderBottom: `1px solid ${BORDER}`,
    overflowX: "auto"
  },
  topicPill: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
    border: `1px solid ${BORDER}`,
    background: "#f7f8fc",
    color: NAVY,
    padding: "7px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: FONT
  },
  topicPillLast: {
    borderLeft: `1px solid ${BORDER}`,
    marginLeft: 4,
    paddingLeft: 14
  },
  topicIcon: { fontSize: 13 },
  body: { padding: 22, overflowY: "auto", flex: 1 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(28, 35, 64, 0.4)",
    marginBottom: 12
  },
  suggestions: { display: "flex", flexDirection: "column", gap: 10 },
  suggestionButton: {
    textAlign: "left",
    border: `1px solid ${BORDER}`,
    background: "#fafbfe",
    color: NAVY,
    padding: "14px 16px",
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: FONT
  },
  thread: { display: "flex", flexDirection: "column", gap: 12 },
  msg: { padding: "12px 14px", borderRadius: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", fontSize: 14 },
  user: {
    alignSelf: "flex-end",
    background: "#eef1fb",
    color: NAVY,
    maxWidth: "85%"
  },
  assistant: {
    alignSelf: "flex-start",
    background: "#fafbfe",
    border: `1px solid ${BORDER}`,
    color: NAVY,
    maxWidth: "85%"
  },
  typing: { color: "rgba(28, 35, 64, 0.5)", fontStyle: "italic" },
  msgText: {},
  bullets: { marginTop: 10, color: "rgba(28, 35, 64, 0.85)" },
  sources: { marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}` },
  sourcesLabel: { fontSize: 11, color: "rgba(28, 35, 64, 0.5)", marginBottom: 6 },
  sourceList: { margin: 0, paddingLeft: 18 },
  link: { color: ACCENT, textDecoration: "underline" },
  chips: { marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" },
  chip: {
    border: `1px solid ${BORDER}`,
    background: "#ffffff",
    color: NAVY,
    padding: "6px 12px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 12,
    fontFamily: FONT
  },
  inputRow: {
    display: "flex",
    gap: 10,
    padding: 16,
    borderTop: `1px solid ${BORDER}`,
    alignItems: "center",
    background: "#fafbfe"
  },
  inputIcon: { fontSize: 16, opacity: 0.6 },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    border: `1px solid ${BORDER}`,
    background: "#ffffff",
    color: NAVY,
    padding: "0 16px",
    outline: "none",
    fontSize: 14,
    fontFamily: FONT
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    border: "none",
    background: NAVY,
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  }
};
