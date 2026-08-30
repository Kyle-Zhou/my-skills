---
description: Generate Mermaid diagrams from an agent plan
allowed-tools: Read, Bash(find:*), Bash(grep:*)
---

Turn the provided plan into one or more Mermaid diagrams. Follow these steps:

1. **Parse the plan.** Accept the plan as inline text after the command, or if none is given, ask the user to paste it or provide a file path and read it.

2. **Identify diagram types needed:**
   - System components and their relationships → `flowchart TD`
   - Request/response or event sequences → `sequenceDiagram`
   - Data models or entity relationships → `erDiagram`
   - State transitions → `stateDiagram-v2`
   Generate only the diagram types that are actually useful for the given plan. Skip types that add no information.

3. **Write the diagrams.** Use real names from the plan — never generic labels like `ComponentA`. Keep each diagram focused on one concern; split into multiple diagrams rather than cramming everything into one.

4. **Output format:**
   - Heading per diagram (e.g. `## System Architecture`, `## Request Flow`)
   - Mermaid code block
   - One-sentence explanation of what the diagram shows
   - No other prose

Do not implement anything. Do not suggest next steps. Just produce the diagrams.
