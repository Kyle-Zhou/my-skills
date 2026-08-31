---
description: Launch a local web UI to review uncommitted changes side-by-side, like an IDE diff view
allowed-tools: Bash(node:*)
---

Show the user their current uncommitted changes (staged, unstaged, and new files) in a local, browser-based diff viewer — old version on the left, new on the right, like an IDE diff.

## Steps

1. Run the bundled server from this skill's own directory (the directory containing this SKILL.md), in the background so it doesn't block the conversation:
   ```
   node server.js
   ```
2. The server prints a `http://localhost:<port>` URL and tries to open it in the default browser automatically. Report the URL to the user in case the browser didn't open.
3. The server keeps running until stopped — mention that closing the process (Ctrl+C, or the agent's background-task controls) shuts it down. Don't stop it yourself unless asked.

## What it shows

- Left sidebar: a collapsible directory tree (like GitHub's PR file view), split into a "Staged Changes" section and a "Changes" (unstaged) section — a file with both staged and unstaged edits appears in both, each with its own diff.
- Main panel: side-by-side diff for the selected file, removed lines highlighted red, added lines highlighted green. Drag the divider between the two sides to resize them.
- A light/dark mode toggle floating in the top-right corner (persists across runs via localStorage).

No arguments needed — it diffs the current working tree against `HEAD` in whatever directory `server.js` is run from (must be inside a git repo).
