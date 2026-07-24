const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

const envCandidates = [
  path.resolve(__dirname, ".env"),
  path.resolve(__dirname, "../.env"),
];

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
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
const { createOrchestrationService } = require("./orchestrator");

const app = express();
const orchestrationService = createOrchestrationService();

app.use(cors({ origin: "*", credentials: false }));
app.use(express.json({ limit: "2mb" }));

function requireApiKey(req) {
  const expected = process.env.API_KEY;
  if (!expected) return;
  const received = req.headers["x-api-key"];
  if (!received || received !== expected) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "zoro",
    workspaceRoot: WORKSPACE_ROOT,
    orchestration: {
      enabled: true,
      defaultMaxParallelAgents: Number.parseInt(
        process.env.ZORO_MAX_PARALLEL_AGENTS || "4",
        10,
      ),
    },
    timestamp: new Date().toISOString(),
  });
});

app.get("/ls", (req, res) => {
  try {
    requireApiKey(req);
    const requestedPath = req.query.path || "";
    const items = listDir(requestedPath);
    res.json({ ok: true, path: requestedPath, items });
  } catch (error) {
    res.status(error.status || 400).json({ ok: false, error: error.message });
  }
});

app.post("/read", (req, res) => {
  try {
    requireApiKey(req);
    const { path: requestedPath } = req.body || {};
    if (!requestedPath) {
      return res.status(400).json({ ok: false, error: "path required" });
    }
    const content = readFile(requestedPath);
    return res.json({ ok: true, path: requestedPath, content });
  } catch (error) {
    return res
      .status(error.status || 400)
      .json({ ok: false, error: error.message });
  }
});

app.post("/write", (req, res) => {
  try {
    requireApiKey(req);
    const { path: requestedPath, content } = req.body || {};
    if (!requestedPath) {
      return res.status(400).json({ ok: false, error: "path required" });
    }
    if (typeof content !== "string") {
      return res
        .status(400)
        .json({ ok: false, error: "content must be a string" });
    }

    const result = writeFile(requestedPath, content);
    return res.json({ ok: true, path: requestedPath, ...result });
  } catch (error) {
    return res
      .status(error.status || 400)
      .json({ ok: false, error: error.message });
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
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res
      .status(error.status || 400)
      .json({ ok: false, error: error.message });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    requireApiKey(req);
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ ok: false, error: "messages[] required" });
    }

    const base = (process.env.BRAIN_BASE_URL || "http://127.0.0.1:11434/v1")
      .replace(/\/$/, "");
    const model = process.env.BRAIN_MODEL || "dolphin-llama3:latest";
    const brainKey = process.env.BRAIN_API_KEY || "ollama-local";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${brainKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "You are Zoro, a precise AI coding agent. Respond directly. No storytelling. No roleplay. No unnecessary explanation.",
            },
            ...messages,
          ],
          temperature: 0.1,
          max_tokens: 300,
          stream: false,
        }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return res.status(response.status).json({
          ok: false,
          error: data?.error?.message || data?.error || "Brain request failed",
        });
      }

      return res.json({
        ok: true,
        model,
        text: data?.choices?.[0]?.message?.content?.trim() || "",
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return res.status(error.name === "AbortError" ? 504 : error.status || 500).json({
      ok: false,
      error: error.name === "AbortError" ? "Brain timeout" : error.message,
    });
  }
});

app.post("/api/orchestrations", async (req, res) => {
  try {
    requireApiKey(req);
    const body = req.body || {};
    if (!body.request && (!Array.isArray(body.jobs) || body.jobs.length === 0)) {
      return res.status(400).json({
        ok: false,
        error: "request or jobs[] is required",
      });
    }

    const run = await orchestrationService.createRun(body);
    return res.status(201).json({ ok: true, run });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      error: error.message,
      runId: error.runId || null,
    });
  }
});

app.get("/api/orchestrations/:runId", (req, res) => {
  try {
    requireApiKey(req);
    const run = orchestrationService.getRun(req.params.runId);
    if (!run) {
      return res.status(404).json({ ok: false, error: "Run not found" });
    }
    return res.json({ ok: true, run });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ ok: false, error: error.message });
  }
});

const PORT = process.env.PORT || 5050;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Zoro agent server running on http://localhost:${PORT}`);
  });
}

module.exports = { app, orchestrationService };
