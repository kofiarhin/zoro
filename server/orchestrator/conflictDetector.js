function normalizePath(value) {
  const path = String(value || "*")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
  return path || "*";
}

function pathsOverlap(left, right) {
  const a = normalizePath(left);
  const b = normalizePath(right);
  if (a === "*" || b === "*") return true;
  if (a === b) return true;
  return a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function jobsConflict(left, right) {
  if (left.readOnly && right.readOnly) return false;

  const leftRepository = left.repository || "__default__";
  const rightRepository = right.repository || "__default__";
  if (leftRepository !== rightRepository) return false;

  const leftPaths = left.ownedPaths?.length ? left.ownedPaths : ["*"];
  const rightPaths = right.ownedPaths?.length ? right.ownedPaths : ["*"];

  return leftPaths.some((leftPath) =>
    rightPaths.some((rightPath) => pathsOverlap(leftPath, rightPath)),
  );
}

module.exports = { normalizePath, pathsOverlap, jobsConflict };
