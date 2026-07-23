# Zoro Product Requirements Document

## 1. Product summary

Zoro is a developer-focused AI agent intended to help inspect, modify, and operate software projects through a governed local workspace. The current repository provides the first product slice: a browser-based chat client, a local Express API, workspace-scoped file tools, and an allowlisted command runner.

The product should evolve from a local coding assistant into a reliable project-execution interface that can coordinate repository work, Context API records, verification, and delivery without weakening security or traceability.

## 2. Problem statement

Developers using general-purpose AI assistants often have to manually copy project context, apply code changes, run commands, and record outcomes across multiple systems. This creates context loss, inconsistent execution, and weak auditability.

Zoro should reduce that friction by providing one controlled interface that can:

- understand the selected project and workspace;
- read and update approved files;
- run a constrained set of development commands;
- communicate with a configurable AI model;
- preserve a clear boundary between suggested work and completed work;
- integrate with repository and project-tracking systems only through explicit, governed actions.

## 3. Goals

### 3.1 Near-term goals

1. Provide a dependable local chat interface for coding assistance.
2. Permit file reads and writes only inside an approved workspace root.
3. Permit command execution only from an explicit allowlist.
4. Make configuration, security boundaries, and operational limitations visible.
5. Add automated verification for core file, command, and chat behavior.

### 3.2 Longer-term goals

1. Connect Zoro to Context API for project and task state.
2. Support governed GitHub inspection and change delivery.
3. Record durable execution summaries and verification evidence.
4. Support project-specific instructions and safety policies.
5. Provide a consistent operator experience across local and hosted environments.

## 4. Non-goals

The current product does not aim to:

- provide unrestricted shell access;
- operate outside the configured workspace root;
- expose a public, unauthenticated remote agent;
- claim successful implementation without verification evidence;
- replace source control, CI, issue tracking, or deployment systems;
- autonomously merge, deploy, migrate, or change production systems without explicit authorization.

## 5. Target users

### Primary user

A developer or technical operator who wants an AI assistant to inspect and modify a local project while retaining control over file access and commands.

### Secondary users

- Maintainers coordinating work across several repositories.
- Technical leads who need traceable project and task updates.
- Operators testing local or self-hosted language models.

## 6. Core user journeys

### 6.1 Start a local coding session

1. The user configures the approved workspace and model endpoint.
2. The user starts the client and server.
3. The user opens the browser client and submits a request.
4. Zoro sends the conversation to the configured model provider.
5. The user receives a response and may choose to perform file or command operations.

### 6.2 Inspect a project file

1. The user requests a file inside the configured workspace.
2. Zoro validates and resolves the path.
3. Zoro returns UTF-8 content or a clear error.
4. Requests outside the workspace are rejected.

### 6.3 Modify a project file

1. The user supplies a relative path and replacement content.
2. Zoro validates the destination against the workspace boundary.
3. Zoro creates parent directories when needed.
4. Zoro writes the file and returns the resolved path.

### 6.4 Run a development command

1. The user submits an allowlisted command and arguments.
2. Zoro validates the command.
3. Zoro runs it with a timeout and output-size limit.
4. Zoro returns stdout, stderr, exit code, and truncation state.

## 7. Functional requirements

### FR-1: Workspace configuration

- The server shall accept a configurable workspace root.
- The server shall reject resolved paths outside that root.
- The health endpoint shall report the configured workspace root for operator visibility.

### FR-2: File listing

- The server shall list files and directories for an approved relative path.
- Results shall distinguish files from directories.
- Missing or unauthorized paths shall return a structured error.

### FR-3: File reading

- The server shall read UTF-8 text files inside the approved workspace.
- The server shall reject invalid, missing, or out-of-bound paths.

### FR-4: File writing

- The server shall write UTF-8 content inside the approved workspace.
- Parent directories may be created automatically.
- The server shall not write outside the approved workspace.

### FR-5: Command execution

- Only explicitly allowlisted commands shall run.
- Execution shall be subject to a configurable or fixed timeout.
- Captured output shall be bounded.
- Responses shall include exit status and timeout information.

### FR-6: Chat proxy

- The server shall accept a message array.
- The server shall call a configurable OpenAI-compatible chat-completions endpoint.
- The server shall return the assistant message and model metadata.
- Provider failures shall return a non-success response with a useful error.

### FR-7: API protection

- The server shall support an optional API key.
- When configured, protected endpoints shall require the matching `x-api-key` header.
- Health checks may remain unprotected for local diagnostics.

### FR-8: User interface

- The client shall provide a clear chat experience.
- The client shall visibly distinguish user and assistant messages.
- The client shall show loading and error states.
- The client shall allow server configuration without code changes where practical.

## 8. Non-functional requirements

### Security

- Least-privilege workspace access.
- Explicit command allowlist.
- No committed secrets.
- Clear warnings against public exposure without additional controls.
- Future remote operation must add authentication, authorization, audit logging, rate limiting, and transport security.

### Reliability

- File and command failures must not crash the process.
- Requests must return structured errors.
- Timeouts must stop or report long-running commands.

### Maintainability

- Routes, controllers, tools, and configuration should remain modular.
- Core behavior must be covered by automated tests.
- Documentation must match the implemented entrypoints and scripts.

### Observability

- Health status shall be available through an endpoint.
- Server logs should identify failed operations without exposing secrets.
- Future versions should emit structured operation records.

## 9. Success metrics

For the local foundation:

- 100% of attempted path escapes are rejected in automated tests.
- 100% of non-allowlisted commands are rejected in automated tests.
- Core file and command operations have automated coverage.
- A new developer can install and start the project using only the README.
- No secrets are required in committed files.

For later orchestration capabilities:

- Every durable project or repository mutation has an attributable operation record.
- Verification evidence is attached before work is marked complete.
- Integration failures are surfaced without silently losing project state.

## 10. Milestones

### Milestone 1: Documentation and startup correctness

- Complete README, PRD, and technical specification.
- Correct and verify production startup scripts.
- Document all environment variables.

### Milestone 2: Automated verification

- Add unit tests for safe-path resolution.
- Add API tests for file and command endpoints.
- Add mocked tests for chat-provider failures and success responses.
- Add CI for install, lint, test, and build.

### Milestone 3: Hardened local agent

- Replace synchronous file operations where appropriate.
- Add request validation and consistent error schemas.
- Improve process termination on timeout.
- Add configurable command policy.

### Milestone 4: Project orchestration integrations

- Add Context API project and task operations.
- Add governed GitHub repository operations.
- Add durable execution and verification summaries.
- Add operator confirmation for sensitive actions.

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Workspace misconfiguration exposes unintended files. | High | Default to a narrow workspace, validate every resolved path, add tests. |
| Command runner enables harmful operations. | High | Keep a minimal allowlist, validate arguments, add isolation for remote use. |
| Public exposure permits unauthorized access. | High | Require API key, bind locally by default, document deployment controls. |
| Model output is treated as verified work. | Medium | Separate suggestions from actions and require verification evidence. |
| Provider-specific assumptions reduce portability. | Medium | Keep the chat API OpenAI-compatible and configuration-driven. |

## 12. Open questions

- Should file mutations support patch-based updates in addition to full replacement?
- Should command policy be configured per project?
- What operation history must be retained locally versus in Context API?
- Which actions require operator confirmation in hosted deployments?
- Should the client expose project and repository selection directly?
