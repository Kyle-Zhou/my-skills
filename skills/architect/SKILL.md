---
description: Sync system architecture and data-flow diagrams with the codebase; update README
allowed-tools: Read, Edit, Bash(find:*), Bash(grep:*), Bash(git log:*), Bash(git diff:*)
---

Keep system architecture and data-flow diagrams synchronized with the current codebase, then write them into the bottom of README.md.

## Steps

### 1. Understand the codebase

Scan enough of the project to answer these questions accurately:
- What are the main modules, services, or layers? Where do they live?
- How does data enter the system (API routes, CLI args, events, queues)?
- How does data flow between components (function calls, HTTP, queues, DB reads/writes)?
- What external dependencies exist (databases, third-party APIs, background workers)?

Use `find`, `grep`, and `Read` to inspect real files. Do not invent components that don't exist.

### 2. Generate diagrams

Produce exactly two Mermaid diagrams:

**System Architecture** (`flowchart TD`) — boxes for each major component, arrows for dependencies or calls between them. Label arrows with the mechanism (HTTP, SQL, event, etc.) when it matters.

**Data Flow** (`flowchart LR`) — follow a representative request or operation from entry point through the system to its final output or storage. Use real endpoint/function names.

Only add a third diagram (e.g. `erDiagram` for data model, `sequenceDiagram` for a complex async flow) if the above two genuinely leave something critical unexplained.

### 3. Update README.md

Find README.md in the repo root. Locate the architecture section using these markers:

```
<!-- architecture-start -->
...
<!-- architecture-end -->
```

If the markers exist, replace everything between them with the new diagrams.
If they do not exist, append the following block to the end of README.md:

```markdown
---

## Architecture

<!-- architecture-start -->
...diagrams...
<!-- architecture-end -->
```

Each diagram should have a `###` heading and a one-sentence description above the code block. Nothing else.

### 4. Report

List the components you identified and one sentence on what changed versus the previous diagrams (or "first generation" if no markers existed). Keep it to a short bullet list.
