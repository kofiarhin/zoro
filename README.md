# Zoro

Zoro is a local-first AI coding and orchestration workspace with a React/Vite client and an Express server. It provides workspace-scoped file operations, an allowlisted command runner, a configurable OpenAI-compatible model connection, and a bounded parallel-worker runtime.

## Current implementation

- React 19 client built with Vite.
- Express 4 API server.
- OpenAI-compatible chat proxy.
- Workspace-scoped file listing, reading and writing.
- Allowlisted command execution with timeout and output limits.
- Optional `x-api-key` protection.
- Parallel orchestration runs with dependency-aware scheduling.
- Bounded worker concurrency, path ownership conflict detection and partial-failure preservation.
- Specialist worker roles for architecture, backend, frontend, review, QA, research and documentation.
- In-memory run inspection through the API.
- Node test coverage for scheduling, dependency graphs, conflict detection and aggregation.

The current worker runtime performs parallel model tasks and returns structured evidence. It does not yet create isolated Git worktrees, apply worker-generated patches automatically, persist runs across restarts, merge branches or deploy software.

## Repository structure

```text
client/                         React and Vite interface
server/
  config/                       Workspace configuration and safe-path handling
  orchestrator/                 Planner, scheduler, workers, store and tests
  server.js                     Express application and API routes
  tools.js                      File and command tools
docs/
  PRD.md
  TECHNICAL_SPECIFICATION.md
  PARALLEL_ORCHESTRATION.md
package.json
```

## Requirements

- Node.js 18 or newer. Node.js 20+ is recommended.
- npm.
- An OpenAI-compatible chat-completions endpoint.

## Configuration

Create a root `.env` or `server/.env` file. Do not commit secrets.

```env
PORT=5050
API_KEY=replace-with-a-strong-local-key
WORKSPACE_ROOT=C:\path\to\approved\workspace
BRAIN_BASE_URL=http://127.0.0.1:11434/v1
BRAIN_MODEL=dolphin-llama3:latest
BRAIN_API_KEY=ollama-local
ZORO_MAX_PARALLEL_AGENTS=4
ZORO_MAX_JOBS=12
ZORO_AGENT_JOB_TIMEOUT_MS=120000
```

## Installation

```bash
npm install
npm install --prefix client
```

## Development

```bash
npm run dev
```

Run only the server:

```bash
npm run server
```

Run the tests:

```bash
npm test
```

The server defaults to `http://localhost:5050`.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Return service, workspace and orchestration status. |
| `GET` | `/ls?path=<relative-path>` | List a directory inside the approved workspace. |
| `POST` | `/read` | Read a UTF-8 file. |
| `POST` | `/write` | Write a UTF-8 file. |
| `POST` | `/run` | Run an allowlisted command. |
| `POST` | `/api/chat` | Send a normal chat request to the model provider. |
| `POST` | `/api/orchestrations` | Plan and execute a bounded parallel worker run. |
| `GET` | `/api/orchestrations/:runId` | Read the current or final run record. |

### Start an orchestration run

Zoro can ask the planner model to decompose a request:

```bash
curl -X POST http://localhost:5050/api/orchestrations \
  -H "Content-Type: application/json" \
  -H "x-api-key: replace-with-a-strong-local-key" \
  -d '{
    "request": "Review the API, propose frontend integration, and produce a QA plan",
    "project": "Example",
    "repository": "owner/repo",
    "maxConcurrency": 3
  }'
```

A caller may also supply an explicit deterministic job graph:

```json
{
  "request": "Inspect and document authentication",
  "repository": "owner/repo",
  "maxConcurrency": 2,
  "jobs": [
    {
      "id": "inspect-api",
      "role": "research",
      "objective": "Inspect the authentication API contract",
      "readOnly": true,
      "ownedPaths": ["server"]
    },
    {
      "id": "inspect-client",
      "role": "research",
      "objective": "Inspect current client authentication usage",
      "readOnly": true,
      "ownedPaths": ["client/src"]
    },
    {
      "id": "qa-plan",
      "role": "qa",
      "objective": "Produce an acceptance verification plan",
      "dependencies": ["inspect-api", "inspect-client"],
      "readOnly": true
    }
  ]
}
```

Independent jobs run concurrently. Dependent jobs wait. Mutating jobs with overlapping `ownedPaths` are not scheduled in the same batch. Worker failures are retained without erasing successful sibling results.

## Security boundaries

Zoro can access files and run selected commands, so treat it as a privileged development tool.

- Set `WORKSPACE_ROOT` to a dedicated least-privilege directory.
- Set `API_KEY` whenever the server is reachable by anything other than the local machine.
- Do not expose the server directly to the public internet.
- Review the command allowlist in `server/tools.js`.
- Keep provider credentials in environment variables.
- Do not treat worker output as verified implementation or project completion.
- Do not use mutating parallel jobs against one shared workspace until isolated worktrees or sandboxes are implemented.

## Product documentation

- [Product Requirements Document](docs/PRD.md)
- [Technical Specification](docs/TECHNICAL_SPECIFICATION.md)
- [Parallel Orchestration Runtime](docs/PARALLEL_ORCHESTRATION.md)

## Status

The local coding-agent foundation and bounded parallel model-worker runtime are implemented. Durable persistence, isolated Git worktrees, automatic patch application, independent executable verification, hosted hardening and broader Context API/GitHub orchestration remain future work until implemented and verified.
