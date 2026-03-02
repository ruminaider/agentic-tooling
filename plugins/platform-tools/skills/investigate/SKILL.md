---
name: investigate
description: Launch a comprehensive ops investigation to determine if a reported bug is still occurring, how widespread it is, and what needs to be done.
---

# Ops Investigation Orchestrator

You are an **orchestrator only**. Follow each phase sequentially, spawning
subagents where indicated. Do NOT skip phases or combine them.

**CRITICAL — Context Protection Rule:**
You must NEVER directly call investigation tools. All DB queries, NewRelic NRQL,
code searches (Grep/Glob/Read of source code), and log queries MUST be performed
by subagents. The only tools you may use directly are:
- `mcp__notion__notion-fetch` / `mcp__slack__conversations_history` (Phase 0 context)
- Preflight connectivity checks (Preflight phase — see below)
- `Read` for schema documentation files only (Phase 1a)
- `Skill` tool (Phase 1b)
- `Task` tool to launch subagents
- `AskUserQuestion` to get info from the user
- Text output to synthesize reports

If you find yourself wanting to "just check one more thing" — launch a subagent.
Every direct query you make bloats the main context and risks running out of space
before the investigation completes.

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

## Preflight: Tool Availability Check

**CRITICAL — Run this BEFORE any investigation work.** This prevents wasting
subagent turns on an investigation that will be blocked by unavailable tools.

Run connectivity checks directly from the orchestrator (this is the one
exception to the Context Protection Rule — preflight checks return single-row
responses and do not bloat context):

1. **Database access**: Run a simple query against your DB tool (e.g., `SELECT 1`)
2. **Infrastructure platform**: Verify workspace/project selection succeeds

Run both checks in parallel. Then evaluate the results:

**If ANY check fails → HALT the entire investigation.**
- Tell the user exactly which tool failed and what error was returned.
- Do NOT proceed to Phase 1 or any subsequent phase.
- Do NOT attempt workarounds (e.g., using a monitoring tool instead of the
  database, or proceeding with code-only analysis and noting "DB was
  unavailable" in the report).
- Do NOT launch subagents that will independently discover the tool is down.
- Wait for the user to resolve the connectivity issue, then resume.

**Rationale:** Every investigation phase depends on DB access for entity state
queries and infrastructure tools for deploy/log correlation. An investigation
without these tools produces incomplete results that can mislead rather than
inform. Halting early costs nothing; a partial investigation wastes significant
time and context.

**If both checks pass → proceed to Phase 1.**

## Phase 1: Code Grounding

### Step 1a: Schema from docs (main agent, NO subagent)

If your project has schema documentation (e.g., a schema index file), read it
to identify which domain file(s) are relevant, then read only those 1-2 domain
files. This gives you table names, columns, FKs, and status choices **without
any code search**.

### Step 1b: Domain skill check (main agent, NO subagent)

Check if a **domain skill** exists for this type of investigation. Domain-specific
skills provide targeted investigation runbooks for common issue categories. If a
matching skill exists, invoke it with the Skill tool to load its methodology.

### Step 1c: Targeted code search (Explore subagent, max_turns=15)

Launch an **Explore subagent** (Task tool with subagent_type=Explore, max_turns=15)
with a **specific, narrowed prompt** based on what you learned in Phase 0.

**Prompt construction rules:**
- Name the exact feature/page/endpoint to investigate (e.g., "the /dashboard page
  rendered after login" not "the post-login flow")
- Include specific search terms from the bug report (error messages, status values,
  endpoint paths)
- Tell the subagent what you already know from the schema docs so it doesn't
  rediscover models and table names
- Ask for the specific code path, not a general survey

**Scope by bug type:**
- **Frontend crash/blank screen**: Search for the route, page component, API calls
  made on mount, error boundary, and what data shape the component expects
- **Data/pipeline issue**: Search for the specific processing function, task, or
  webhook handler (models are already known from schema docs)
- **API error**: Search for the endpoint view, serializer, and any middleware/guards
- **External integration**: Search for the client class, webhook handler, and retry logic

**Bad prompt** (too broad, causes 40+ tool calls):
> "Explore the post-login frontend flow and find Django models and their
> relationships, status choices, foreign keys, and processing paths"

**Good prompt** (targeted, ~10-15 tool calls):
> "Find what renders at the /dashboard route after login in the React frontend.
> I need: (1) the route definition, (2) the page component, (3) what API calls
> it makes on mount, (4) what data shape it expects from those APIs. The backend
> models are already known (users_user, orders_order, results_test).
> Focus on what could cause a blank screen for a specific user."

**Output:** Summary of the specific code path, what data it depends on, and what
could break — to inform Phase 2 queries.

## Phase 2: Investigation (Parallel Subagents)

Launch **2 subagents in parallel** (single message, multiple Task tool calls):

### Subagent A - DB Investigation
Use Task tool with subagent_type=`ops-debugger` or a general-purpose agent with DB access.

Instructions for the subagent:
1. First select your infrastructure workspace/project
2. Discover the production database
3. Query **specific entities** mentioned in the bug report to check their current state
4. Query **aggregate recent data** to check if the pattern continues:
   - Group by entity type, status, time period
   - Compare success rates before and after any expected fix date
   - Count how many entities are in each pipeline stage
5. Check **audit logs and data provenance** for specific entities:
   - Query admin log tables for admin changes to affected entities
   - For any unexpectedly NULL or empty field, distinguish NULL vs empty string
   - Check timestamps on related entities for concurrent writes (seconds apart)
   - Reconstruct an event timeline from timestamps across related entities
6. Return: specific entity states, aggregate counts, success rates, anomalies,
   audit log findings, and provenance evidence

### Subagent B - Timeline Analysis
Use Task tool with subagent_type=`general-purpose`.

Instructions for the subagent:
1. Search `git log` for commits related to the bug report keywords
2. Check deploy history for when fixes were deployed
3. Establish timeline: when issue started, when fix deployed, is fix holding
4. Cross-reference deploy dates with the aggregate data trends from Subagent A
5. Check for **concurrent processing evidence**: look for code paths where the same
   entity can be written by multiple processes (webhook + API endpoint, duplicate task
   execution, admin action + background task, etc.)
6. Return: timeline of events, relevant commits, deploy dates, concurrency risks

**Collect summaries from both subagents before proceeding.**

### Handling incomplete results

**Tool connectivity failures are NOT "incomplete results".** If a subagent reports
that a required tool (DB, infrastructure platform, monitoring) is completely
unreachable, HALT the investigation and report the failure to the user — do not
treat it as a gap to work around. The Preflight phase should catch these, but if
a tool goes down mid-investigation, the same halt-and-report rule applies.

For cases where tools are working but results are incomplete (e.g., access
restrictions blocked a query, or you need a user ID from the human), do NOT make
direct queries yourself. Instead:

1. Ask the user for any missing information (IDs, context) via AskUserQuestion
2. Launch a **follow-up subagent** (Task tool with subagent_type=`general-purpose`
   or `ops-debugger`) with:
   - The specific unanswered questions
   - Any new information from the user (e.g., user_id)
   - Context from Phase 2 results so the subagent doesn't redo completed work
3. Collect the follow-up results, then proceed to Phase 3

You may run up to 2 follow-up rounds. If questions remain unanswered after that,
proceed to Phase 3 with what you have and note the gaps in the report.

## Phase 3: Verification Loop

Launch the **verify-root-cause** agent (Task tool with subagent_type=`platform-tools:verify-root-cause`):
- Pass all findings from Phase 2
- Pass the specific claims to verify (e.g., "the issue is resolved", "13 orders still affected")
- Request pipeline verification mode if this is a data pipeline investigation

**Loop logic (max 3 iterations):**

- If verdict is **CONFIRMED**: proceed to Phase 4

- If verdict is **WEAK**: Re-run Phase 2 with targeted prompts focused on the
  weak points identified by the verifier. Dispatch the same agent types —
  `ops-debugger` for DB queries and `general-purpose` for timeline/code —
  with prompts that address the specific gaps (e.g., "verify the exact timestamp
  of X" or "check counter-evidence for Y"). Collect results, then re-verify.

- If verdict is **REFUTED**: The verifier found the investigation was wrong.
  Determine what changed:

  **If fundamental assumptions were wrong** (wrong feature, wrong form, wrong
  endpoint, wrong entity type): Re-run from **Phase 1c** — launch a new Explore
  subagent (max_turns=15) to ground the corrected understanding, then re-run
  Phase 2 with `ops-debugger` + `general-purpose` subagents using corrected
  prompts. Then re-verify.

  **If the hypothesis was wrong but assumptions were correct** (right feature,
  wrong root cause): Re-run **Phase 2 only** — dispatch `ops-debugger` +
  `general-purpose` subagents with prompts that explicitly exclude the refuted
  hypothesis and explore alternative explanations. Then re-verify.

  In both cases: synthesize what the verifier found into the new subagent
  prompts so they don't repeat the same mistake.

**CRITICAL — Context Protection still applies during re-investigation.**
Do NOT run Explore agents, DB queries, code searches, or any investigation
work directly from the orchestrator during the verification loop. All
re-investigation MUST go through subagents via the Task tool. If you find
yourself wanting to "just quickly check" the corrected form/endpoint/entity,
that check belongs in a subagent prompt.

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

## Tool Selection Guide (for subagent prompts)

These tools are used **inside subagents**, not by the main orchestrator.
When writing subagent prompts, reference these tools so the subagent knows what's available.

| Investigation Need | Tool for Subagent to Use |
|-------------------|--------------------------|
| Current entity state | DB query tool (prefer sanitized access if available) |
| Recent errors/patterns | Log viewer or NewRelic NRQL |
| Fix deployment status | `git log` + deploy history tool |
| Code behavior | Read, Grep, Glob |
| External context | `mcp__notion__notion-fetch`, `mcp__slack__conversations_history` |
| Infrastructure workspace | Select workspace/project before other infra queries |
