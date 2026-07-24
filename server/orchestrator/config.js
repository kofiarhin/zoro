function readPositiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

const orchestrationConfig = Object.freeze({
  maxConcurrency: readPositiveInteger(
    process.env.ZORO_MAX_PARALLEL_AGENTS,
    4,
    12,
  ),
  maxJobs: readPositiveInteger(process.env.ZORO_MAX_JOBS, 12, 50),
  workerTimeoutMs: readPositiveInteger(
    process.env.ZORO_AGENT_JOB_TIMEOUT_MS,
    120000,
    900000,
  ),
});

module.exports = { orchestrationConfig, readPositiveInteger };
