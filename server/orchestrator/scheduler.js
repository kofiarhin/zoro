const { jobsConflict } = require("./conflictDetector");

const TERMINAL_STATUSES = new Set(["completed", "blocked", "failed"]);

function selectCompatibleBatch(readyJobs, maxConcurrency) {
  const selected = [];
  for (const job of readyJobs) {
    if (selected.length >= maxConcurrency) break;
    if (!selected.some((candidate) => jobsConflict(job, candidate))) {
      selected.push(job);
    }
  }
  return selected;
}

class Scheduler {
  constructor({ runner, maxConcurrency = 4 }) {
    this.runner = runner;
    this.maxConcurrency = Math.max(1, maxConcurrency);
  }

  async execute(run, onUpdate = () => {}) {
    const jobsById = new Map(run.jobs.map((job) => [job.id, job]));

    while (run.jobs.some((job) => !TERMINAL_STATUSES.has(job.status))) {
      for (const job of run.jobs.filter(
        (candidate) => candidate.status === "queued",
      )) {
        const dependencyJobs = job.dependencies.map((id) => jobsById.get(id));
        const failedDependency = dependencyJobs.find(
          (dependency) =>
            dependency && ["blocked", "failed"].includes(dependency.status),
        );
        if (failedDependency) {
          job.status = "blocked";
          job.completedAt = new Date().toISOString();
          job.result = {
            status: "blocked",
            summary: `Blocked by dependency ${failedDependency.id}`,
            blockers: [
              `Dependency ${failedDependency.id} is ${failedDependency.status}`,
            ],
          };
          onUpdate(run);
        }
      }

      const readyJobs = run.jobs.filter((job) => {
        if (job.status !== "queued") return false;
        return job.dependencies.every(
          (dependencyId) =>
            jobsById.get(dependencyId)?.status === "completed",
        );
      });

      const batch = selectCompatibleBatch(readyJobs, this.maxConcurrency);
      if (batch.length === 0) {
        const remaining = run.jobs.filter((job) => job.status === "queued");
        for (const job of remaining) {
          job.status = "blocked";
          job.completedAt = new Date().toISOString();
          job.result = {
            status: "blocked",
            summary: "No schedulable dependency-safe execution path remains",
            blockers: ["Dependency or ownership scheduling deadlock"],
          };
        }
        onUpdate(run);
        break;
      }

      for (const job of batch) {
        job.status = "running";
        job.startedAt = new Date().toISOString();
      }
      onUpdate(run);

      const settled = await Promise.allSettled(
        batch.map((job) => this.runner({ run, job })),
      );

      settled.forEach((outcome, index) => {
        const job = batch[index];
        job.completedAt = new Date().toISOString();
        if (outcome.status === "fulfilled") {
          job.result = outcome.value;
          job.status = ["blocked", "failed"].includes(outcome.value?.status)
            ? outcome.value.status
            : "completed";
        } else {
          job.status = "failed";
          job.result = {
            status: "failed",
            summary: outcome.reason?.message || "Worker failed",
            blockers: [outcome.reason?.message || "Unknown worker failure"],
          };
        }
      });
      onUpdate(run);
    }

    return run.jobs;
  }
}

module.exports = { Scheduler, TERMINAL_STATUSES, selectCompatibleBatch };
