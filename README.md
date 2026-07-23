# Zoro

Zoro is an AI-assisted coding-agent workspace with a React client and an Express server. The current repository implementation provides a local chat interface, workspace-scoped file operations, and an allowlisted command runner. The broader Zoro product direction also includes project orchestration through Context API and governed GitHub operations, but those capabilities are not implemented in this repository unless explicitly listed below.

## Current implementation

- React 19 client built with Vite.
- Express 4 API server.
- OpenAI-compatible chat proxy for a configurable model endpoint.
- Workspace-scoped file listing, reading, and writing.
- Allowlisted command execution with timeout and output limits.
- Optional `x-api-key` protection for server endpoints.
- Health endpoint for basic runtime checks.

## Repository structure

```text
client/                 React and Vite user interface
server/
  config/               Workspace configuration and safe-path handling
  controllers/          Server controllers
  routes/               Route modules
  server.js             Main Express application
  tools.js              File and command tools
request.rest            Example API requests
package.json            Root development scripts and server dependencies
```

## Requirements

- Node.js 18 or newer. Node.js 20+ is recommended.
- npm.
- An OpenAI-compatible chat-completions endpoint, such as a local Ollama-compatible gateway.

## Configuration

Create a root `.env` file or `server/.env` file. Do not commit secrets.

```env
PORT=5050
API_KEY=replace-with-a-strong-local-key
WORKSPACE_ROOT=C:\path\to\approved\workspace
BRAIN_BASE_URL=http://127.0.0.1:11434/v1
BRAIN_MODEL=dolphin-llama3:latest
BRAIN_API_KEY=ollama-local
```

`API_KEY` is optional in the current implementation. When it is set, protected endpoints require the same value in the `x-api-key` header.

## Installation

```bash
npm install
npm install --prefix client
```

## Development

Run the server and client together:

```bash
npm run dev
```

Or run them separately:

```bash
npm run server
npm run client
```

The server defaults to `http://localhost:5050`. The Vite development server uses its normal local port.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Return server health and configured workspace root. |
| `GET` | `/ls?path=<relative-path>` | List a directory inside the approved workspace. |
| `POST` | `/read` | Read a UTF-8 file from the approved workspace. |
| `POST` | `/write` | Write a UTF-8 file inside the approved workspace. |
| `POST` | `/run` | Run an allowlisted command. |
| `POST` | `/api/chat` | Send messages to the configured chat-completions provider. |

Example request:

```bash
curl -X POST http://localhost:5050/read \
  -H "Content-Type: application/json" \
  -H "x-api-key: replace-with-a-strong-local-key" \
  -d '{"path":"README.md"}'
```

## Security boundaries

Zoro can read and write files and execute selected commands, so it should be treated as a privileged local development tool.

- Set `WORKSPACE_ROOT` to a dedicated, least-privilege directory.
- Set `API_KEY` whenever the server is reachable by anything other than the local machine.
- Do not expose the server directly to the public internet.
- Review the command allowlist in `server/tools.js` before use.
- Keep model-provider credentials in environment variables.
- Do not use the tool against production workspaces without additional authorization, auditing, and isolation controls.

## Known implementation notes

- The command runner is Windows-oriented and invokes `cmd.exe` through `ComSpec`.
- The root `start` script currently points to `server.js`, while the implemented server entrypoint is `server/server.js`; production startup should be verified before deployment.
- Automated tests and CI are not present in the current repository.
- The current API uses synchronous file operations.

## Product documentation

- [Product Requirements Document](docs/PRD.md)
- [Technical Specification](docs/TECHNICAL_SPECIFICATION.md)

## Status

The local coding-agent foundation is implemented. Production hardening, automated verification, deployment configuration, and integration with the broader Zoro/Context API orchestration model remain future work until implemented and verified in this repository.
