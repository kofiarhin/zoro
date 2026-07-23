# Zoro Technical Specification

## 1. Scope

This specification describes the current `kofiarhin/zoro` implementation and the minimum technical controls required to evolve it safely. It covers the React client, Express server, OpenAI-compatible chat proxy, workspace file tools, and allowlisted command runner.

## 2. System context

Zoro is a local-first web application with two runtime processes:

1. A Vite-powered React client presents the user interface.
2. An Express server exposes file, command, health, and chat endpoints.

The server connects to two external resources:

- a configured local filesystem workspace;
- an OpenAI-compatible chat-completions provider.

```text
Browser
  |
  v
React/Vite client
  |
  v
Express API server
  |--------------------> OpenAI-compatible model endpoint
  |
  +--------------------> Approved local workspace
  |
  +--------------------> Allowlisted local commands
```

## 3. Runtime and dependencies

### Root/server

- Node.js runtime.
- Express 4.
- `cors` middleware.
- `dotenv` for environment loading.
- `openai` SDK configured against a custom base URL.
- `nodemon` and `concurrently` for development.

### Client

- React 19.
- React DOM 19.
- Vite 7.
- ESLint 9.
- Axios is installed for HTTP communication.

## 4. Repository layout

```text
client/
  src/                  React application source
  package.json          Client scripts and dependencies
server/
  config/               Workspace-root and safe-path configuration
  controllers/          Route business logic
  routes/               Express route declarations
  server.js             Express bootstrap and chat endpoint
  tools.js              File and command operations
docs/
  PRD.md
  TECHNICAL_SPECIFICATION.md
package.json             Root scripts and server dependencies
request.rest             Manual API examples
```

## 5. Configuration

The server loads environment variables from the root `.env` file and `server/.env`.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | No | `5050` | Express listening port. |
| `API_KEY` | No for local use | Empty | Optional shared secret checked via `x-api-key`. |
| `WORKSPACE_ROOT` | Strongly recommended | Current working directory | Filesystem boundary for read/write/list operations. |
| `BRAIN_BASE_URL` | No | `http://127.0.0.1:11434/v1` | OpenAI-compatible provider base URL. |
| `BRAIN_MODEL` | No | `dolphin-llama3:latest` | Model identifier passed to chat completions. |
| `BRAIN_API_KEY` | Provider-dependent | `ollama-local` | Provider credential. |

### Configuration requirements

- Production or shared usage must set `API_KEY`.
- `WORKSPACE_ROOT` must resolve to a dedicated directory.
- Secrets must not appear in repository files or logs.
- Hosted deployments should add bind-address configuration rather than implicitly exposing all interfaces.

## 6. API design

### 6.1 Health

`GET /health`

Response:

```json
{
  "ok": true,
  "service": "zoro",
  "workspaceRoot": "C:\\approved\\workspace",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Purpose:

- process liveness;
- service identity;
- operator confirmation of workspace configuration.

### 6.2 Directory listing

`GET /ls?path=<relative-path>`

Behavior:

- resolve the requested path against `WORKSPACE_ROOT`;
- reject any path that escapes the root;
- return directory entries with name and type information.

### 6.3 File reading

`POST /read`

Request:

```json
{
  "path": "src/index.js"
}
```

Response:

```json
{
  "path": "C:\\approved\\workspace\\src\\index.js",
  "content": "..."
}
```

### 6.4 File writing

`POST /write`

Request:

```json
{
  "path": "src/index.js",
  "content": "replacement content"
}
```

Behavior:

- validate the path;
- create parent directories recursively;
- write UTF-8 content;
- return the resolved path.

### 6.5 Command execution

`POST /run`

Request:

```json
{
  "command": "npm",
  "args": ["test"],
  "cwd": ".",
  "timeoutMs": 120000
}
```

Response shape:

```json
{
  "command": "npm test",
  "cwd": "C:\\approved\\workspace",
  "exitCode": 0,
  "stdout": "...",
  "stderr": "",
  "timedOut": false,
  "truncated": false
}
```

Current implementation characteristics:

- commands are checked against an allowlist in `server/tools.js`;
- Windows `cmd.exe` is used through `ComSpec`;
- timeout and output-size limits are enforced;
- command isolation is not provided.

### 6.6 Chat

`POST /api/chat`

Request:

```json
{
  "messages": [
    {"role": "user", "content": "Explain this project"}
  ]
}
```

Behavior:

- validate that `messages` is an array;
- call `chat.completions.create` using the configured model;
- return the first assistant message and model identifier;
- return an error response when the provider fails.

## 7. Authentication and authorization

The current server uses an optional shared API key.

### Current behavior

- When `API_KEY` is empty, protected endpoints are effectively unauthenticated.
- When configured, clients must send `x-api-key` with an exact match.

### Required hardening for non-local use

- Require authentication by default.
- Use timing-safe credential comparison where appropriate.
- Add per-user or per-service authorization.
- Add rate limiting.
- Use TLS termination.
- Record mutation and command audit events.
- Separate read, write, command, and administration permissions.

## 8. Filesystem safety

All filesystem paths must be treated as untrusted input.

### Required invariant

After normalization and resolution, every target path must be either:

- exactly `WORKSPACE_ROOT`; or
- a descendant of `WORKSPACE_ROOT`.

### Required checks

- reject absolute paths supplied by callers unless intentionally supported;
- reject traversal through `..`;
- account for platform-specific case behavior;
- evaluate symlink behavior and prevent symlink-based escapes;
- reject non-text or oversized files where appropriate;
- return stable error codes for invalid, missing, and unauthorized paths.

## 9. Command safety

### Current controls

- explicit command allowlist;
- bounded runtime;
- bounded output;
- caller-selected working directory constrained to the workspace.

### Required improvements

- validate arguments, not only command names;
- avoid shell interpolation where possible;
- terminate child process trees on timeout;
- support platform-neutral execution;
- optionally run commands in containers or restricted sandboxes;
- classify commands as read-only, mutating, or destructive;
- require explicit confirmation for destructive classes;
- capture executable version and invocation metadata for auditability.

## 10. Error model

The server should converge on a consistent response shape:

```json
{
  "error": {
    "code": "PATH_OUTSIDE_WORKSPACE",
    "message": "The requested path is outside the approved workspace.",
    "details": {}
  }
}
```

Recommended status mapping:

| Status | Use |
| --- | --- |
| `400` | Invalid request shape or unsupported operation. |
| `401` | Missing or invalid authentication. |
| `403` | Authenticated but unauthorized operation or path. |
| `404` | File or route not found. |
| `409` | Operation conflicts with current state. |
| `413` | Input or output exceeds limits. |
| `500` | Unexpected internal error. |
| `502` | Upstream model provider failure. |
| `504` | Command or provider timeout. |

## 11. Client behavior

The client should:

- maintain ordered conversation state;
- render user and assistant messages distinctly;
- prevent duplicate submission while a request is in flight;
- expose provider and server errors without leaking secrets;
- support configurable server base URL;
- include the API key through a safe local configuration mechanism;
- avoid persisting sensitive messages unless the user opts in.

## 12. Testing strategy

### Unit tests

- safe path resolution;
- absolute and relative path edge cases;
- allowlist decisions;
- output truncation;
- environment configuration parsing.

### API tests

- health response;
- authentication success and failure;
- list, read, and write happy paths;
- path traversal rejection;
- invalid command rejection;
- timeout handling;
- chat validation and provider failure behavior.

### Client tests

- message submission;
- loading state;
- error rendering;
- ordered response rendering;
- API-key and base-URL configuration.

### End-to-end tests

- start server and client in an isolated temporary workspace;
- read and update a fixture file;
- run an allowlisted non-destructive command;
- complete a mocked chat request.

## 13. CI requirements

A minimum CI pipeline should run on pull requests and `main`:

1. Install root dependencies.
2. Install client dependencies.
3. Run linting.
4. Run server and client tests.
5. Build the client.
6. Scan for committed secrets.
7. Report dependency vulnerabilities without auto-fixing breaking changes.

## 14. Deployment considerations

The current repository is development-oriented. Before deployment:

- correct and verify the production start script;
- build and serve the client through a defined deployment topology;
- set explicit host binding and CORS policy;
- require authentication;
- place the service behind TLS;
- run with a least-privilege OS identity;
- use a dedicated workspace volume;
- define backup and recovery behavior for mutated files;
- add structured logs and health/readiness probes.

## 15. Known gaps

- Root `start` script and implemented server entrypoint are inconsistent.
- No automated tests are committed.
- No CI workflow is present.
- File operations are synchronous.
- The command runner is platform-specific.
- Authentication is optional and coarse-grained.
- Symlink escape behavior is not documented as verified.
- No durable audit log exists.
- Broader Context API and GitHub orchestration described by the product direction is not implemented in this repository.

## 16. Acceptance criteria for the documented baseline

The baseline is considered technically documented when:

- README startup instructions match verified scripts;
- all environment variables are documented;
- every endpoint has a documented purpose and request shape;
- security boundaries and known gaps are explicit;
- PRD and technical specification are linked from the root README;
- automated tests are subsequently added for the critical safety invariants.
