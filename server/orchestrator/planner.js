const { normalizeJobs } = require("./schema");
const { extractJson } = require("./json");

const PLANNER_SYSTEM_PROMPT = `You are Zoro's planning worker. Convert the request into a small dependency graph of specialist jobs.
Return JSON only with this shape:
{
  "summary": "one sentence",
  "jobs": [{
    "id": "stable-short-id",
    "role": "architect|builder-backend|builder-frontend|builder|reviewer|qa|research|documentation",
    "objective": "bounded task",
    "dependencies": [],
    "readOnly": true,
    "ownedPaths": ["path/or/*"],
    "acceptanceCriteria": ["observable result"],
    "inScope": [],
    "outOfScope": []
  }]
}
Rules:
- Create only necessary jobs.
- Use dependencies for work that cannot begin immediately.
- Mark research, review and planning jobs readOnly when they do not mutate files.
- Mutating jobs must declare ownedPaths. Use "*" only when the entire repository is genuinely owned.
- Reviewer and QA jobs depend on the implementation jobs they verify.
- Never add merge, deployment, migration or destructive work unless the request explicitly authorizes it.`;

async function createPlan({
  request,
  jobs,
  project,
  repository,
  runKey,
  context,
  modelClient,
  maxJobs,
}) {
  if (Array.isArray(jobs) && jobs.length) {
    return {
      summary: "User-supplied execution plan",
      jobs: normalizeJobs(jobs, {
        maxJobs,
        project,
        repository,
        runKey,
      }),
    };
  }

  if (!request || typeof request !== "string") {
    throw new Error("request is required when jobs are not supplied");
  }

  const text = await modelClient.complete({
    messages: [
      { role: "system", content: PLANNER_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({ request, project, repository, context }),
      },
    ],
    temperature: 0,
    maxTokens: 2400,
  });

  const parsed = extractJson(text);
  return {
    summary: String(parsed.summary || "Generated execution plan"),
    jobs: normalizeJobs(parsed.jobs, {
      maxJobs,
      project,
      repository,
      runKey,
    }),
  };
}

module.exports = { createPlan, PLANNER_SYSTEM_PROMPT };
