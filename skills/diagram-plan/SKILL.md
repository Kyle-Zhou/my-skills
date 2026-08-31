---
description: Plan and diagram — takes an existing plan or an implementation question and produces a written plan with Mermaid diagrams
allowed-tools: Read, Bash(find:*), Bash(grep:*)
---

Accept either an existing plan or a question about implementing something, then produce a written plan and Mermaid diagrams for it.

## Step 1 — Determine the input mode

- **Existing plan:** the input is already a structured plan (bullet points, numbered steps, or a file path to read). Go straight to Step 3.
- **Implementation question:** the input is a task or question ("how should I implement X?", "I need to build Y"). Do Step 2 first.

If nothing is provided, ask for it.

## Step 2 — Create the plan (only for implementation questions)

Inspect the codebase enough to give grounded recommendations:
- Read relevant existing files with `find` and `Read`
- Identify what already exists that can be reused
- Resolve any decisions that would be expensive to undo (data shapes, API boundaries, auth)

Write a concise implementation plan:
- **What** needs to be built or changed, in order
- **Where** — specific files or modules
- **Key decisions** with brief rationale

Keep it tight. This plan feeds the diagrams; it is not a spec document.

## Step 3 — Generate the diagrams

From the plan (provided or created in Step 2), produce the diagram types that are actually useful:

- System components and their relationships → `flowchart TD`
- Request/response or event sequences → `sequenceDiagram`
- Data models or entity relationships → `erDiagram`
- State transitions → `stateDiagram-v2`

Use real names from the plan — never generic labels like `ComponentA`. Keep each diagram focused on one concern; split rather than cram.

## Output format

1. If you wrote a plan in Step 2, show it first under `## Plan`
2. Then the diagrams — one `##` heading per diagram, Mermaid code block, one-sentence explanation

Do not implement anything. Do not suggest next steps beyond what the plan already covers.
