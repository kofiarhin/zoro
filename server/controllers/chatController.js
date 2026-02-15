const assertApiKey = (req) => {
  const key = req.headers["x-api-key"];
  if (!process.env.API_KEY) return; // allow if not set
  if (!key || key !== process.env.API_KEY) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
};

exports.chat = async (req, res) => {
  try {
    assertApiKey(req);

    const { messages, temperature = 0.7 } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ ok: false, error: "messages[] required" });
    }

    const base = process.env.BRAIN_BASE_URL || "http://127.0.0.1:11434/v1";
    const model = process.env.BRAIN_MODEL || "llama3";
    const apiKey = process.env.BRAIN_API_KEY || "ollama-local";

    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: false,
      }),
    });

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        error: data?.error?.message || data?.error || "Brain request failed",
        raw: data,
      });
    }

    const text = data?.choices?.[0]?.message?.content ?? "";
    return res.json({ ok: true, text, raw: data });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, error: e.message });
  }
};
