class InMemoryRunStore {
  constructor() {
    this.runs = new Map();
  }

  save(run) {
    this.runs.set(run.id, run);
    return run;
  }

  get(runId) {
    return this.runs.get(runId) || null;
  }
}

module.exports = { InMemoryRunStore };
