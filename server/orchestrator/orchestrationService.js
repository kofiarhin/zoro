const { randomUUID } = require("crypto");
const { createPlan } = require("./planner");
const { Scheduler } = require("./scheduler");
const { aggregateRun } = require("./resultAggregator");
const { orchestrationConfig } = require("./config");

class OrchestrationService {
  constructor({ store, modelClient, runner }) {
    this.store = store;
    this.modelClient = modelClient;
    this.runner = runner;
  }

  async createRun(input = {}) {
    const id = randomUUID();
    const maxConcurrency = Math.min(
      Math.max(
        Number.parseInt(input.maxConcurrency, 10) ||
          orchestrationConfig.maxConcurrency,
        1,
      ),
      orchestrationConfig.maxConcurrency,
    );

    const run = {
      id,
      runKey: input.runKey || `zoro:${id}`,
      request: String(input.request || "").trim(),
      project: input.project || null,
      repository: input.repository || null,
      context:
        input.context && typeof input.context === "object" ? input.context : {},
      status: "planning",
      maxConcurrency,
      planSummary: null,
      jobs: [],
      result: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    };
    this.store.save(run);

    try {
      const plan = await createPlan({
        request: run.request,
        jobs: input.jobs,
        project: run.project,
        repository: run.repository,
        runKey: run.runKey,
        context: run.context,
        modelClient: this.modelClient,
        maxJobs: orchestrationConfig.maxJobs,
      });

      run.planSummary = plan.summary;
      run.jobs = plan.jobs.map((job) => ({
        ...job,
        status: "queued",
        startedAt: null,
        completedAt: null,
        result: null,
      }));
      run.status = "running";
      run.startedAt = new Date().toISOString();
      this.store.save(run);

      const scheduler = new Scheduler({
        runner: this.runner,
        maxConcurrency,
      });
      await scheduler.execute(run, (updatedRun) => this.store.save(updatedRun));

      run.result = aggregateRun(run);
      run.status = run.result.status;
      run.completedAt = new Date().toISOString();
      this.store.save(run);
      return run;
    } catch (error) {
      run.status = "failed";
      run.completedAt = new Date().toISOString();
      run.result = {
        status: "failed",
        summary: error.message,
        counts: { failed: 1 },
      };
      this.store.save(run);
      error.runId = id;
      throw error;
    }
  }

  getRun(runId) {
    return this.store.get(runId);
  }
}

module.exports = { OrchestrationService };
