const { ModelClient } = require("./modelClient");
const { createAgentRunner } = require("./agentRunner");
const { InMemoryRunStore } = require("./runStore");
const { OrchestrationService } = require("./orchestrationService");
const { orchestrationConfig } = require("./config");

function createOrchestrationService(options = {}) {
  const modelClient =
    options.modelClient ||
    new ModelClient({ timeoutMs: orchestrationConfig.workerTimeoutMs });
  const store = options.store || new InMemoryRunStore();
  const runner = options.runner || createAgentRunner({ modelClient });
  return new OrchestrationService({ store, modelClient, runner });
}

module.exports = {
  createOrchestrationService,
  OrchestrationService,
  InMemoryRunStore,
  ModelClient,
};
