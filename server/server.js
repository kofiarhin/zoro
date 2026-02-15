// server/server.js
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// load env reliably no matter where you run from
const envCandidates = [
  path.resolve(__dirname, ".env"), // server/.env
  path.resolve(__dirname, "../.env"), // root/.env
];

for (const p of envCandidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const express = require("express");
const cors = require("cors");

const {
  readFile,
  writeFile,
  listDir,
  runCommand,
  WORKSPACE_ROOT,
} = require("./tools");

const app = express();

app.use(cors({ origin: "*", credentials: false }));
app.use(express.json({ limit: "2mb" }));

const requireApiKey = (req) => {
  const expected = process.env.API_KEY;
  if (!expected) return;
  const got = req.headers["x-api-key"];
  if (!got || got !== expected) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
};

app.get("/health", (req, res) => {
  res.json({ ok: true, workspaceRoot: WORKSPACE_ROOT });
});

app.get("/ls", (req, res) => {
  try {
    requireApiKey(req);
    const p = req.query.path || "";
    const items = listDir(p);
    res.json({ ok: true, path: p, items });
  } catch (err) {
    res.status(err.status || 400).json({ ok: false, error: err.message });
  }
});

app.post("/read", (req, res) => {
  try {
    requireApiKey(req);
    const { path } = req.body || {};
    if (!path)
      return res.status(400).json({ ok: false, error: "path required" });
    const content = readFile(path);
    res.json({ ok: true, path, content });
  } catch (err) {
    res.status(err.status || 400).json({ ok: false, error: err.message });
  }
});

app.post("/write", (req, res) => {
  try {
    requireApiKey(req);
    const { path, content } = req.body || {};
    if (!path)
      return res.status(400).json({ ok: false, error: "path required" });
    if (typeof content !== "string")
      return res
        .status(400)
        .json({ ok: false, error: "content must be a string" });

    const result = writeFile(path, content);
    res.json({ ok: true, path, ...result });
  } catch (err) {
    res.status(err.status || 400).json({ ok: false, error: err.message });
  }
});

app.post("/run", async (req, res) => {
  try {
    requireApiKey(req);
    const { cmd, opts } = req.body || {};
    if (!Array.isArray(cmd) || cmd.length === 0) {
      return res.status(400).json({ ok: false, error: "cmd must be an array" });
    }
    const result = await runCommand(cmd, opts || {});
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 400).json({ ok: false, error: err.message });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    requireApiKey(req);

    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ ok: false, error: "messages[] required" });
    }

    const temperature = 0.1;
    const max_tokens = 300;

    const base = process.env.BRAIN_BASE_URL || "http://127.0.0.1:11434/v1";
    const model = process.env.BRAIN_MODEL || "dolphin-llama3:latest";
    const brainKey = process.env.BRAIN_API_KEY || "ollama-local";

    const systemPrompt = {
      role: "system",
      content:
        "You are Zoro, a precise AI coding agent. Respond directly. No storytelling. No roleplay. No unnecessary explanation. Keep answers under 5 sentences unless explicitly asked.",
    };

    const finalMessages = [systemPrompt, ...messages];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${brainKey}`,
      },
      body: JSON.stringify({
        model,
        messages: finalMessages,
        temperature,
        max_tokens,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        error: data?.error?.message || data?.error || "Brain request failed",
      });
    }

    const text = data?.choices?.[0]?.message?.content?.trim() ?? "";

    return res.json({
      ok: true,
      model,
      text,
    });
  } catch (err) {
    res.status(err.name === "AbortError" ? 504 : err.status || 500).json({
      ok: false,
      error: err.name === "AbortError" ? "Brain timeout" : err.message,
    });
  }
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`Zoro agent server running on http://localhost:${PORT}`);
});
