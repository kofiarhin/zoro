// server/config/workspace.js
const path = require("path");

const RAW_ROOT = (process.env.WORKSPACE_ROOT || "").trim();

// ✅ fallback so dev doesn’t crash if env isn’t loaded yet
// server/config -> server -> repo root
const WORKSPACE_ROOT = RAW_ROOT
  ? path.resolve(RAW_ROOT)
  : path.resolve(__dirname, "..", "..");

// robust “is inside root” check (Windows-safe)
function assertInsideWorkspace(targetPath) {
  const rel = path.relative(WORKSPACE_ROOT, targetPath);

  if (rel === "") return; // exact root is fine

  // outside if starts with ".." or becomes absolute (Windows edge cases)
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Access denied: Path outside workspace.");
  }
}

function resolveSafePath(relativePath = "") {
  const rp = String(relativePath ?? "")
    .trim()
    .replace(/^[/\\]+/, "");

  // allow empty / "." to represent the workspace root
  if (rp === "" || rp === ".") return WORKSPACE_ROOT;

  const targetPath = path.resolve(WORKSPACE_ROOT, rp);
  assertInsideWorkspace(targetPath);

  return targetPath;
}

module.exports = {
  WORKSPACE_ROOT,
  resolveSafePath,
};
