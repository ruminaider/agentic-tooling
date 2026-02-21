---
name: investigate
description: Launch a comprehensive ops investigation to determine if a reported bug is still occurring, how widespread it is, and what needs to be done.
---

# Ops Investigation Orchestrator

You are running a phased investigation pipeline. Follow each phase sequentially,
spawning subagents where indicated. Do NOT skip phases or combine them.

## Phase 0: Context Gathering + User Checkpoint

1. If a Notion/Slack URL is provided, fetch it using MCP tools
   (`mcp__notion__notion-fetch` or `mcp__slack__conversations_history`)
2. If no URL is provided, ask the user what to investigate
3. Extract from the context:
   - Reported symptoms (what's broken?)
   - Specific entity IDs, order numbers, or email addresses
   - Timeline (when was this reported? when did it start?)
4. Summarize your understanding back to the user:
   "Here's what I understand the issue to be: [X]. Should I investigate this?"
5. **WAIT for user confirmation before proceeding.** Use AskUserQuestion if needed.

## Phase 1: Code Grounding

Launch an **Explore subagent** (Task tool with subagent_type=Explore) to:
- Find the relevant Django models and their relationships
- Discover status choices, foreign keys, processing paths
- Identify how different entity types are routed to different processing logic
- Determine table names, column names, and junction tables

Also check if a **domain skill** exists for this type of investigation. Domain-specific skills provide targeted investigation runbooks for common issue categories. If a matching skill exists, invoke it with the Skill tool to load its methodology.

**Output:** Summary of schema, pipeline stages, and processing paths to inform Phase 2 queries.

## Phase 2: Investigation (Parallel Subagents)

Launch **2 subagents in parallel** (single message, multiple Task tool calls):

### Subagent A - DB Investigation
Use Task tool with subagent_type=`ops-debugger` or a general-purpose agent with DB access.

Instructions for the subagent:
1. First select Render workspace: `mcp__render__select_workspace(ownerID="<YOUR_WORKSPACE_ID>")`
2. Discover production database ID via `mcp__render__list_postgres_instances()`
3. Query **specific entities** mentioned in the bug report to check their current state
4. Query **aggregate recent data** to check if the pattern continues:
   - Group by entity type, status, time period
   - Compare success rates before and after any expected fix date
   - Count how many entities are in each pipeline stage
5. Check **audit logs and data provenance** for specific entities:
   - Query `django_admin_log` for admin changes to affected entities
   - For any unexpectedly NULL or empty field, distinguish NULL vs empty string
   - Check timestamps on related entities for concurrent writes (seconds apart)
   - Reconstruct an event timeline from timestamps across related entities
6. Return: specific entity states, aggregate counts, success rates, anomalies,
   audit log findings, and provenance evidence

### Subagent B - Timeline Analysis
Use Task tool with subagent_type=`general-purpose`.

Instructions for the subagent:
1. Search `git log` for commits related to the bug report keywords
2. Check Render deploy history (`mcp__render__list_deploys`) for when fixes were deployed
3. Establish timeline: when issue started, when fix deployed, is fix holding
4. Cross-reference deploy dates with the aggregate data trends from Subagent A
5. Check for **concurrent processing evidence**: look for code paths where the same
   entity can be written by multiple processes (webhook + API endpoint, duplicate task
   execution, admin action + background task, etc.)
6. Return: timeline of events, relevant commits, deploy dates, concurrency risks

**Collect summaries from both subagents before proceeding.**

## Phase 3: Verification Loop

Launch the **verify-root-cause** agent (Task tool with subagent_type=`platform-tools:verify-root-cause`):
- Pass all findings from Phase 2
- Pass the specific claims to verify (e.g., "the issue is resolved", "13 orders still affected")
- Request pipeline verification mode if this is a data pipeline investigation

**Loop logic (max 3 iterations):**
- If verdict is **CONFIRMED**: proceed to Phase 4
- If verdict is **WEAK**: launch a targeted re-investigation subagent focusing
  on the weak points identified, then re-verify
- If verdict is **REFUTED**: launch a broader re-investigation subagent that
  re-examines assumptions, then re-verify

## Phase 4: Report Synthesis

If a domain skill is loaded, use its categorization framework.

Produce a report with these sections:

### Status Summary
Is the issue resolved, ongoing, or partially resolved?

### Timeline
When did the issue start? When was it fixed (if applicable)? Is the fix holding?

### Specific Reported Items
Current state of each entity mentioned in the original bug report.

### Aggregate Data
Fill rates, success rates, processing patterns across the relevant time period.

### Categorized Affected Items
Group all affected entities using the domain skill's categorization framework
(or a generic working / in-progress / bug classification).

### Recommended Actions
- **Manual intervention items:** specific entities that need admin fixes
- **Code fixes needed:** if the root cause is a code bug
- **Monitoring suggestions:** what to watch going forward

## Tool Selection Guide

| Investigation Need | Tool to Use |
|-------------------|-------------|
| Current entity state | `mcp__render__query_render_postgres` |
| Recent errors/patterns | `mcp__render__list_logs` or NewRelic NRQL |
| Fix deployment status | `git log` + `mcp__render__list_deploys` |
| Code behavior | Explore subagent (Read, Grep, Glob) |
| External context | `mcp__notion__notion-fetch`, `mcp__slack__conversations_history` |
| Render workspace (always first) | `mcp__render__select_workspace(ownerID="<YOUR_WORKSPACE_ID>")` |
