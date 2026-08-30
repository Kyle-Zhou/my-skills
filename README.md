# Skills

A small suite of reusable skills for coding agents — Claude Code, Conductor, Cursor, and Codex.

## Skills

### `/diagram-plan`
Turns a plan into Mermaid diagrams. Pass a plan as inline text or a file path; outputs whichever diagram types are actually useful (flowchart, sequence, ER, state) with a one-sentence explanation each. No prose, no implementation — just the diagrams.

### `/architect`
Scans the codebase and keeps system architecture and data-flow diagrams synchronized with the code. Writes diagrams into a dedicated section at the bottom of `README.md` using `<!-- architecture-start -->` / `<!-- architecture-end -->` markers. Re-running updates them in place.

---

## Installation

### Prerequisites
Node.js 18+

### Install all skills

**User-wide (all projects):**
```bash
node scripts/install.js
```

**Current project only:**
```bash
node scripts/install.js --project
```

### Install a single skill
```bash
node scripts/install.js diagram-plan
node scripts/install.js architect --project
```

### Target a specific agent

```bash
# Claude Code (default)
node scripts/install.js --target claude

# Conductor (same as Claude Code — Conductor runs Claude Code)
node scripts/install.js --target conductor

# Cursor
node scripts/install.js --target cursor

```

Flags can be combined:
```bash
node scripts/install.js architect --target cursor --project
```

### Updating

Re-run the same install command. Files that haven't changed are skipped; changed ones are overwritten. No manual cleanup needed.

---

## Usage

| Agent | How to invoke |
|---|---|
| Claude Code | `/diagram-plan`, `/architect` |
| Conductor | `/diagram-plan`, `/architect` |
| Cursor | Type `@diagram-plan` or `@architect` in chat |

---

## Adding a skill

1. Create `skills/<name>/SKILL.md`
2. Add frontmatter with `description` and `allowed-tools` (Claude Code syntax — the installer transforms it per target)
3. Write the instructions in the body
4. Run `node scripts/install.js`

### SKILL.md template

```markdown
---
description: One-line description of what this skill does
allowed-tools: Read, Bash(find:*), Bash(grep:*)
---

Instructions for Claude to follow when this skill is invoked...
```

---

## How it works

Skills are plain markdown files. The installer copies them to the right location for each agent, transforming agent-specific frontmatter as needed:

| Target | Install location | Format |
|---|---|---|
| `claude` | `~/.claude/commands/` or `.claude/commands/` | `.md` with Claude frontmatter |
| `conductor` | `~/.claude/commands/` or `.claude/commands/` | `.md` with Claude frontmatter |
| `cursor` | `~/.cursor/rules/` or `.cursor/rules/` | `.mdc` with Cursor frontmatter |

No servers to start. No config to edit manually. The skill content is agent-agnostic — only the delivery format changes.
