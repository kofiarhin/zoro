import { useState } from "react";
import "./App.styles.scss";

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "system", content: "You are Zoro. Be concise and helpful." },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiUrl = import.meta.env.VITE_API_URL;
  const apiKey = import.meta.env.VITE_API_KEY;

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setError("");
    setLoading(true);

    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");

    try {
      const r = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          messages: next,
          temperature: 0.7,
        }),
      });

      const data = await r.json();

      if (!r.ok || !data?.ok) {
        throw new Error(data?.error || "Request failed");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.text },
      ]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="zoro">
      <header className="zoro__header">
        <h1 className="zoro__title">Zoro</h1>
        <p className="zoro__sub">Client → Server → Brain</p>
      </header>

      <main className="zoro__chat">
        {messages
          .filter((m) => m.role !== "system")
          .map((m, idx) => (
            <div
              key={idx}
              className={`zoro__msg ${
                m.role === "user" ? "zoro__msg--user" : "zoro__msg--bot"
              }`}
            >
              <div className="zoro__msgRole">{m.role}</div>
              <div className="zoro__msgText">{m.content}</div>
            </div>
          ))}

        {loading && <div className="zoro__status">Thinking...</div>}
        {error && <div className="zoro__error">{error}</div>}
      </main>

      <footer className="zoro__composer">
        <textarea
          className="zoro__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="zoro__btn" onClick={send} disabled={loading}>
          Send
        </button>
      </footer>
    </div>
  );
}
