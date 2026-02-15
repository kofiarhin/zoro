const { spawn } = require("child_process");

const COMSPEC = process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe";

const URL_REGEX =
  /(https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/[^\s]*)?)/i;

function nowIso() {
  return new Date().toISOString();
}

function createRingBuffer(limit = 400) {
  const buf = [];
  return {
    push(line) {
      buf.push(line);
      if (buf.length > limit) buf.shift();
    },
    all() {
      return buf.slice();
    },
    clear() {
      buf.length = 0;
    },
  };
}

class DevServerManager {
  constructor({ cwd }) {
    this.cwd = cwd;
    this.proc = null;
    this.pid = null;
    this.startedAt = null;
    this.url = null;
    this.lastExit = null;

    this.logs = createRingBuffer(600);
  }

  isRunning() {
    return !!this.proc && this.proc.exitCode == null && !this.proc.killed;
  }

  status() {
    return {
      running: this.isRunning(),
      pid: this.pid,
      cwd: this.cwd,
      url: this.url,
      startedAt: this.startedAt,
      lastExit: this.lastExit,
    };
  }

  getLogs() {
    return this.logs.all();
  }

  _appendLog(stream, chunk) {
    const text = String(chunk || "");
    const lines = text.split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      const entry = `[${nowIso()}] [${stream}] ${line}`;
      this.logs.push(entry);

      if (!this.url) {
        const m = line.match(URL_REGEX);
        if (m && m[1]) this.url = m[1];
      }
    }
  }

  async start(cmdArray = ["npm", "run", "dev"]) {
    if (this.isRunning()) {
      return { ok: true, alreadyRunning: true, ...this.status() };
    }

    this.logs.clear();
    this.url = null;
    this.lastExit = null;

    const commandStr = cmdArray
      .map((x) => {
        const s = String(x);
        return /\s/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
      })
      .join(" ");

    // long-running: no timeout, no buffer cap besides ring buffer
    const child = spawn(COMSPEC, ["/d", "/s", "/c", commandStr], {
      cwd: this.cwd,
      windowsHide: true,
      shell: false,
      env: process.env,
    });

    this.proc = child;
    this.pid = child.pid;
    this.startedAt = nowIso();

    child.stdout.on("data", (d) => this._appendLog("stdout", d));
    child.stderr.on("data", (d) => this._appendLog("stderr", d));

    child.on("close", (code, signal) => {
      this.lastExit = {
        at: nowIso(),
        code: code == null ? null : code,
        signal: signal || null,
      };
      this.proc = null;
      this.pid = null;
    });

    return { ok: true, started: true, ...this.status() };
  }

  async stop() {
    if (!this.isRunning()) {
      return { ok: true, alreadyStopped: true, ...this.status() };
    }

    const pid = this.pid;

    // Kill process tree on Windows
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        windowsHide: true,
      });

      killer.on("close", () => resolve());
      killer.on("error", () => resolve());
    });

    return { ok: true, stopped: true, ...this.status() };
  }
}

module.exports = { DevServerManager };
