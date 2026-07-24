const ALLOWED_ROLES = new Set([
  "architect",
  "builder-backend",
  "builder-frontend",
  "builder",
  "reviewer",
  "qa",
  "research",
  "documentation",
]);

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function normalizeJob(rawJob, index, defaults = {}) {
  if (!rawJob || typeof rawJob !== "object") {
    throw new Error(`jobs[${index}] must be an object`);
  }

  const id = String(rawJob.id || `job-${index + 1}`).trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(id)) {
    throw new Error(`Invalid job id: ${id}`);
  }

  const role = String(rawJob.role || "research").trim().toLowerCase();
  if (!ALLOWED_ROLES.has(role)) {
    throw new Error(`Unsupported worker role: ${role}`);
  }

  const objective = String(rawJob.objective || "").trim();
  if (!objective) throw new Error(`Job ${id} requires an objective`);

  const readOnly = rawJob.readOnly === true;
  const ownedPaths = asStringArray(rawJob.ownedPaths);

  return {
    id,
    role,
    objective,
    dependencies: asStringArray(rawJob.dependencies),
    project: rawJob.project || defaults.project || null,
    repository: rawJob.repository || defaults.repository || null,
    workKey: rawJob.workKey || `${defaults.runKey || "run"}:${id}`,
    readOnly,
    ownedPaths: readOnly ? ownedPaths : ownedPaths.length ? ownedPaths : ["*"],
    acceptanceCriteria: asStringArray(rawJob.acceptanceCriteria),
    inScope: asStringArray(rawJob.inScope),
    outOfScope: asStringArray(rawJob.outOfScope),
    metadata:
      rawJob.metadata && typeof rawJob.metadata === "object"
        ? rawJob.metadata
        : {},
  };
}

function assertAcyclic(jobs) {
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const visiting = new Set();
  const visited = new Set();

  function visit(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Dependency cycle detected at ${id}`);

    visiting.add(id);
    const job = byId.get(id);
    for (const dependency of job.dependencies) {
      if (!byId.has(dependency)) {
        throw new Error(`Job ${id} references unknown dependency ${dependency}`);
      }
      if (dependency === id) {
        throw new Error(`Job ${id} cannot depend on itself`);
      }
      visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
  }

  for (const job of jobs) visit(job.id);
}

function normalizeJobs(rawJobs, { maxJobs = 12, ...defaults } = {}) {
  if (!Array.isArray(rawJobs) || rawJobs.length === 0) {
    throw new Error("At least one worker job is required");
  }
  if (rawJobs.length > maxJobs) {
    throw new Error(`A run may contain at most ${maxJobs} jobs`);
  }

  const jobs = rawJobs.map((job, index) => normalizeJob(job, index, defaults));
  const ids = new Set();
  for (const job of jobs) {
    if (ids.has(job.id)) throw new Error(`Duplicate job id: ${job.id}`);
    ids.add(job.id);
  }
  assertAcyclic(jobs);
  return jobs;
}

module.exports = { ALLOWED_ROLES, normalizeJobs, assertAcyclic };
