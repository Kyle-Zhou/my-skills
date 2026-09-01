---
description: End-to-end feature delivery — design doc, subagent review, finalized plan, implementation, tests, and final review
allowed-tools: Read, Write, Edit, Bash(find:*), Bash(grep:*), Bash(git log:*), Bash(git diff:*), Bash(git status:*), Task, SlashCommand
---

Take a feature or change from raw requirements all the way through to reviewed, tested, implemented code. This is a heavier workflow than a quick edit — use it for non-trivial features, not one-line fixes.

## Step 1 — Requirements

Take the requirements as given (inline text or a file path). If something critical is genuinely ambiguous (no target area of the codebase, no acceptance criteria, conflicting asks), ask one clarifying question. Don't interrogate with a checklist — proceed on reasonable assumptions where possible and state them.

## Step 2 — Design doc

Inspect the codebase enough to ground the design in what already exists: relevant modules, existing patterns, data shapes, naming conventions. Write a design doc (in-memory or as a scratch file) covering:

- Problem/goal, 2-3 sentences
- Proposed approach
- Key decisions and alternatives considered — only for choices that are expensive to reverse (data shapes, API boundaries, auth)
- Affected files/modules
- Open risks or unknowns

Keep it a working doc, not a spec novel — a few hundred words plus code-shape sketches where useful.

## Step 3 — Subagent review

Spawn 2-4 subagents in parallel (Task tool) to review the design doc, each from a distinct angle relevant to this change, for example:

- Correctness / edge cases
- Architecture fit / simplicity — does this reuse what's already there, or reinvent it
- Security implications — only if the change touches auth, input handling, or external calls
- Testability / operational risk — what's hardest to verify or most likely to regress

Give each reviewer the design doc plus enough repo context to ground their critique in the real codebase, not generic best practices. Ask each for a short list of concrete, specific concerns — not general praise or a rewrite of the doc.

## Step 4 — Orchestrator triage

Read all reviewer feedback yourself. For each point raised, decide: adopt, reject, or defer, with one line of reasoning each. Don't rubber-stamp every comment — reject feedback that's speculative, out of scope, or contradicts an explicit requirement. This triage is the rationale baked into the plan, not a separate artifact.

## Step 5 — Finalized plan

Write the finalized plan to a markdown file (ask the user where it should live if there's no obvious convention — e.g. a `plans/` or `.context/` directory, or alongside related docs). It should contain:

- Final design, updated with whatever feedback was adopted in Step 4
- Rejected/deferred feedback and why, briefly
- Ordered implementation steps with target files
- Test strategy (scope is decided in Step 7 — just name what will be covered and why)

Then invoke the `diagram-plan` skill against this plan file to generate accompanying Mermaid diagrams, and fold its output into the plan doc under a `## Diagrams` heading.

## Step 6 — Implement

Execute the plan step by step. Follow existing codebase conventions; don't introduce patterns the plan didn't call for, and don't scope-creep beyond it. Check in briefly at major milestones — not after every file.

## Step 7 — Tests (conservative)

Add integration/E2E-style tests, not exhaustive unit coverage. Do not overload the codebase with tests:

- Cover the primary happy path end-to-end
- Cover the highest-risk failure points surfaced in the design or review — bottlenecks, external-call boundaries, or spots most likely to regress later
- Skip tests for trivial glue code, pure pass-throughs, or anything already exercised by existing suite patterns

A small number of high-signal tests beats broad coverage here.

## Step 8 — Final review

Review the complete diff before declaring done:

- If the target repo has a `/code-review` (or similarly named review) skill or command available — check `.claude/commands/`, `.claude/skills/`, or this plugin's own skills — invoke it via SlashCommand or Task.
- Otherwise, spawn a review subagent with a plain, simple prompt: read the full diff, flag correctness bugs and obvious simplifications, keep it lightweight rather than exhaustive.

Apply fixes for anything the review confirms as a real problem. For anything deliberately skipped, say so and why.

## Output

Report: the plan file path, what was implemented, which tests were added and why those specifically, and the outcome of the final review.
