const { extractJson } = require("./json");

const ROLE_GUIDANCE = {
  architect:
    "Produce architecture, boundaries, interfaces, risks and acceptance criteria. Do not implement unless explicitly assigned.",
  "builder-backend":
    "Focus only on backend implementation and its directly required tests or documentation.",
  "builder-frontend":
    "Focus only on frontend implementation and its directly required tests or documentation.",
  builder: "Implement only the assigned scope and preserve repository conventions.",
  reviewer:
    "Independently inspect the supplied evidence and identify defects, scope drift and verification gaps.",
  qa: "Evaluate acceptance criteria and produce executable verification guidance or test evidence supplied in context.",
  research:
    "Perform read-only investigation and clearly separate facts, inference and unknowns.",
  documentation:
    "Produce accurate documentation based only on supplied context and completed evidence.",
};

function normalizeWorkerResult(parsed, rawText) {
  const allowedStatuses = new Set(["completed", "blocked", "failed"]);
  const status = allowedStatuses.has(parsed?.status)
    ? parsed.status
    : "completed";

  return {
    status,
    summary: String(parsed?.summary || rawText || "Worker finished"),
    workPerformed: Array.isArray(parsed?.workPerformed)
      ? parsed.workPerformed
      : [],
    artifacts: Array.isArray(parsed?.artifacts) ? parsed.artifacts : [],
    evidence: Array.isArray(parsed?.evidence) ? parsed.evidence : [],
    verification: Array.isArray(parsed?.verification)
      ? parsed.verification
      : [],
    blockers: Array.isArray(parsed?.blockers) ? parsed.blockers : [],
    risks: Array.isArray(parsed?.risks) ? parsed.risks : [],
    unresolvedQuestions: Array.isArray(parsed?.unresolvedQuestions)
      ? parsed.unresolvedQuestions
      : [],
    raw: parsed,
  };
}

function createAgentRunner({ modelClient }) {
  return async function runAgentJob({ run, job }) {
    const systemPrompt = `You are a bounded ${job.role} worker inside Zoro's orchestration runtime.
${ROLE_GUIDANCE[job.role] || ROLE_GUIDANCE.research}
You are not an independent authority. Do not expand scope, approve your own work, claim unperformed verification, merge, deploy, migrate, expose secrets or mark an Architect task completed.
Return JSON only:
{
  "status": "completed|blocked|failed",
  "summary": "concise result",
  "workPerformed": [],
  "artifacts": [],
  "evidence": [],
  "verification": [],
  "blockers": [],
  "risks": [],
  "unresolvedQuestions": []
}
A worker status of completed means this delegated job returned its result; it is not authoritative project completion.`;

    const workerInput = {
      runId: run.id,
      request: run.request,
      project: job.project || run.project,
      repository: job.repository || run.repository,
      job: {
        id: job.id,
        workKey: job.workKey,
        objective: job.objective,
        dependencies: job.dependencies,
        readOnly: job.readOnly,
        ownedPaths: job.ownedPaths,
        acceptanceCriteria: job.acceptanceCriteria,
        inScope: job.inScope,
        outOfScope: job.outOfScope,
      },
      context: run.context,
      dependencyResults: job.dependencies.map((dependencyId) => {
        const dependency = run.jobs.find(
          (candidate) => candidate.id === dependencyId,
        );
        return dependency
          ? {
              id: dependency.id,
              status: dependency.status,
              result: dependency.result,
            }
          : { id: dependencyId, status: "missing" };
      }),
    };

    const rawText = await modelClient.complete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(workerInput) },
      ],
      temperature: 0.1,
      maxTokens: 2400,
    });

    let parsed;
    try {
      parsed = extractJson(rawText);
    } catch {
      parsed = { status: "completed", summary: rawText };
    }

    return normalizeWorkerResult(parsed, rawText);
  };
}

module.exports = { createAgentRunner, normalizeWorkerResult, ROLE_GUIDANCE };
