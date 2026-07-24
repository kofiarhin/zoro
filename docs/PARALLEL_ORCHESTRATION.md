# Parallel Orchestration Runtime

## Status

Implemented as a bounded local runtime in `server/orchestrator/`.

This implementation gives Zoro fan-out/fan-in behavior for specialist model workers. It does not yet provide autonomous Git worktree creation, automatic patch application, durable database persistence, merge authority or deployment authority.

## Runtime flow

1. `POST /api/orchestrations` creates a run.
2. A supplied job graph is validated, or the planner model produces one.
3. The scheduler identifies jobs whose dependencies are complete.
4. Independent, ownership-compatible jobs run concurrently.
5. `Promise.allSettled` semantics preserve successful sibling results when another job fails.
6. Failed dependencies block downstream jobs.
7. The aggregator produces one run result containing counts, evidence, risks and unresolved questions.
8. `GET /api/orchestrations/:runId` returns the retained in-memory record.

## Worker roles

- `architect`
- `builder-backend`
- `builder-frontend`
- `builder`
- `reviewer`
- `qa`
- `research`
- `documentation`

Workers are bounded execution units. They are not approval, merge, deployment, verification or task-completion authorities.

## Job contract

Each job contains:

- stable job ID;
- role;
- objective;
- dependencies;
- repository and project context;
- stable work key;
- read-only flag;
- owned paths;
- acceptance criteria;
- in-scope and out-of-scope lists;
- metadata.

Mutating jobs without explicit path ownership default to `*`, which prevents them from running alongside another mutating job in the same repository.

## Scheduling rules

A job is ready only when every dependency has completed successfully.

The scheduler selects up to the configured concurrency limit while ensuring selected jobs do not have conflicting ownership. Read-only jobs may run together. Jobs targeting different repositories do not conflict.

A worker may end as:

- `completed` — the delegated job returned a result;
- `blocked` — work could not proceed;
- `failed` — execution failed.

`completed` at worker level is not authoritative project completion.

## Configuration

```env
ZORO_MAX_PARALLEL_AGENTS=4
ZORO_MAX_JOBS=12
ZORO_AGENT_JOB_TIMEOUT_MS=120000
```

The server clamps caller-requested concurrency to the configured maximum.

## Persistence

Runs are currently retained in an in-memory `Map`. Restarting the server removes them.

The next persistence step should introduce MongoDB records for:

- orchestration runs;
- worker jobs;
- execution attempts;
- approvals;
- evidence;
- leases;
- artifacts.

## Required next hardening

Before enabling autonomous parallel code mutation:

1. Create one Git worktree or sandbox per mutating worker.
2. Bind every worker to an isolated branch and audited base revision.
3. Add scoped tool adapters instead of prompt-only workers.
4. Persist runs and leases durably.
5. Add cancellation and resumable approval states.
6. Add Reviewer and QA adapters that execute independent checks.
7. Integrate governed GitHub and Context API operations.
8. Record immutable mutation and verification evidence.
9. Add authentication, authorization, rate limiting and transport security for hosted use.
