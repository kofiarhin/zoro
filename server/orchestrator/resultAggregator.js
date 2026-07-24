function aggregateRun(run) {
  const counts = run.jobs.reduce((summary, job) => {
    summary[job.status] = (summary[job.status] || 0) + 1;
    return summary;
  }, {});

  let status = "completed";
  if (counts.failed) status = "failed";
  else if (counts.blocked) status = "blocked";

  return {
    status,
    summary: `${counts.completed || 0}/${run.jobs.length} worker jobs completed`,
    counts,
    completedJobs: run.jobs
      .filter((job) => job.status === "completed")
      .map((job) => job.id),
    blockedJobs: run.jobs
      .filter((job) => job.status === "blocked")
      .map((job) => job.id),
    failedJobs: run.jobs
      .filter((job) => job.status === "failed")
      .map((job) => job.id),
    evidence: run.jobs.flatMap((job) => job.result?.evidence || []),
    risks: run.jobs.flatMap((job) => job.result?.risks || []),
    unresolvedQuestions: run.jobs.flatMap(
      (job) => job.result?.unresolvedQuestions || [],
    ),
  };
}

module.exports = { aggregateRun };
