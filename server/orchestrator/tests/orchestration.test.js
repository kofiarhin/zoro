const test = require("node:test");
const assert = require("node:assert/strict");
const { pathsOverlap, jobsConflict } = require("../conflictDetector");
const { normalizeJobs } = require("../schema");
const { Scheduler } = require("../scheduler");
const { createOrchestrationService } = require("../index");

test("detects equal and nested path ownership", () => {
  assert.equal(pathsOverlap("server", "server/routes"), true);
  assert.equal(pathsOverlap("client/src", "server"), false);
  assert.equal(pathsOverlap("*", "README.md"), true);
});

test("allows read-only jobs to run together", () => {
  assert.equal(
    jobsConflict(
      { repository: "owner/repo", readOnly: true, ownedPaths: ["*"] },
      { repository: "owner/repo", readOnly: true, ownedPaths: ["*"] },
    ),
    false,
  );
});

test("blocks overlapping mutating jobs in one repository", () => {
  assert.equal(
    jobsConflict(
      { repository: "owner/repo", readOnly: false, ownedPaths: ["server"] },
      {
        repository: "owner/repo",
        readOnly: false,
        ownedPaths: ["server/routes"],
      },
    ),
    true,
  );
});

test("normalizes a valid dependency graph", () => {
  const jobs = normalizeJobs([
    { id: "research", role: "research", objective: "Inspect", readOnly: true },
    {
      id: "docs",
      role: "documentation",
      objective: "Document",
      dependencies: ["research"],
      readOnly: false,
      ownedPaths: ["README.md"],
    },
  ]);

  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs[1].dependencies, ["research"]);
});

test("rejects cycles", () => {
  assert.throws(
    () =>
      normalizeJobs([
        { id: "a", role: "research", objective: "A", dependencies: ["b"] },
        { id: "b", role: "research", objective: "B", dependencies: ["a"] },
      ]),
    /cycle/i,
  );
});

function makeRun(jobs) {
  return {
    id: "run-1",
    request: "test",
    jobs: jobs.map((job) => ({
      dependencies: [],
      readOnly: true,
      ownedPaths: [],
      repository: "owner/repo",
      status: "queued",
      ...job,
    })),
  };
}

test("runs independent jobs in parallel within the concurrency limit", async () => {
  let active = 0;
  let maxActive = 0;
  const runner = async ({ job }) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 20));
    active -= 1;
    return { status: "completed", summary: job.id };
  };

  const run = makeRun([
    { id: "a", objective: "A" },
    { id: "b", objective: "B" },
    { id: "c", objective: "C" },
  ]);

  await new Scheduler({ runner, maxConcurrency: 2 }).execute(run);
  assert.equal(maxActive, 2);
  assert.deepEqual(
    run.jobs.map((job) => job.status),
    ["completed", "completed", "completed"],
  );
});

test("waits for dependencies before running downstream work", async () => {
  const order = [];
  const runner = async ({ job }) => {
    order.push(job.id);
    return { status: "completed", summary: job.id };
  };

  const run = makeRun([
    { id: "first", objective: "First" },
    { id: "second", objective: "Second", dependencies: ["first"] },
  ]);

  await new Scheduler({ runner, maxConcurrency: 4 }).execute(run);
  assert.deepEqual(order, ["first", "second"]);
});

test("preserves successful jobs when another worker fails", async () => {
  const runner = async ({ job }) => {
    if (job.id === "bad") throw new Error("worker exploded");
    return { status: "completed", summary: job.id };
  };

  const run = makeRun([
    { id: "good", objective: "Good" },
    { id: "bad", objective: "Bad" },
  ]);

  await new Scheduler({ runner, maxConcurrency: 2 }).execute(run);
  assert.equal(run.jobs.find((job) => job.id === "good").status, "completed");
  assert.equal(run.jobs.find((job) => job.id === "bad").status, "failed");
});

class FakeModelClient {
  async complete() {
    return JSON.stringify({
      status: "completed",
      summary: "worker result",
      evidence: ["fake-evidence"],
    });
  }
}

test("executes a supplied plan and aggregates worker evidence", async () => {
  const service = createOrchestrationService({
    modelClient: new FakeModelClient(),
  });

  const run = await service.createRun({
    request: "Run two independent checks",
    repository: "owner/repo",
    jobs: [
      { id: "one", role: "research", objective: "One", readOnly: true },
      { id: "two", role: "qa", objective: "Two", readOnly: true },
    ],
    maxConcurrency: 2,
  });

  assert.equal(run.status, "completed");
  assert.equal(run.jobs.length, 2);
  assert.equal(run.result.evidence.length, 2);
});
