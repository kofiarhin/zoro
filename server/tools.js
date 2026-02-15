const fs = require("fs");
const { spawn } = require("child_process");
const { resolveSafePath, WORKSPACE_ROOT } = require("./config/workspace");

// --------------------
// FS TOOLS
// --------------------
function readFile(relativePath) {
  const fullPath = resolveSafePath(relativePath);
  return fs.readFileSync(fullPath, "utf8");
}

function writeFile(relativePath, content) {
  const fullPath = resolveSafePath(relativePath);
  fs.writeFileSync(fullPath, content, "utf8");
  return { success: true };
}

function listDir(relativePath = "") {
  const fullPath = resolveSafePath(relativePath);
  return fs.readdirSync(fullPath);
}

// --------------------
// SHELL TOOL (SAFE)
// --------------------

// allowlist the executable (first token)
const ALLOWED_BINS = new Set(["npm", "node", "git", "npx", "where"]);

// naive blocks even if allowed bin is used
const BLOCKED_TOKENS = [
  "rm ",
  "del ",
  "rmdir",
  "format",
  "shutdown",
  "reboot",
  "reg ",
  "diskpart",
  "powershell",
  "cmd.exe",
  "curl ",
  "wget ",
];

function assertSafeCommand(cmdArray) {
  if (!Array.isArray(cmdArray) || cmdArray.length === 0) {
    throw new Error("Command must be an array like ['npm','run','dev'].");
  }

  const bin = String(cmdArray[0] || "").toLowerCase();

  if (!ALLOWED_BINS.has(bin)) {
    throw new Error(`Command denied: '${bin}' is not in allowlist.`);
  }

  const joined = cmdArray.join(" ").toLowerCase();
  for (const bad of BLOCKED_TOKENS) {
    if (joined.includes(bad)) {
      throw new Error("Command denied: blocked token detected.");
    }
  }
}

function runCommand(cmdArray, opts = {}) {
  assertSafeCommand(cmdArray);

  const {
    timeoutMs = 30000,
    maxOutputChars = 12000,
    cwd = WORKSPACE_ROOT,
  } = opts;

  return new Promise((resolve) => {
    const commandStr = cmdArray
      .map((x) => {
        const s = String(x);
        // quote args that include spaces
        return /\s/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
      })
      .join(" ");

    const COMSPEC = process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe";

    // Use Windows cmd so node/npm resolution works reliably
    const child = spawn(COMSPEC, ["/d", "/s", "/c", commandStr], {
      cwd,
      windowsHide: true,
      shell: false,
    });

    let stdout = "";
    let stderr = "";

    const killTimer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {}
    }, timeoutMs);

    child.stdout.on("data", (d) => {
      stdout += d.toString();
      if (stdout.length > maxOutputChars)
        stdout = stdout.slice(-maxOutputChars);
    });

    child.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > maxOutputChars)
        stderr = stderr.slice(-maxOutputChars);
    });

    child.on("close", (code) => {
      clearTimeout(killTimer);
      resolve({ code, stdout, stderr });
    });
  });
}

module.exports = {
  readFile,
  writeFile,
  listDir,
  runCommand,
  WORKSPACE_ROOT,
};
