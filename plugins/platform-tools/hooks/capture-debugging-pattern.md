---
name: capture-debugging-pattern
description: Prompts to document new debugging patterns after successful operational issue resolution
hooks:
  - event: Stop
    script: |
      # Check if this was a debugging session that resolved an issue
      # This hook fires when Claude stops, allowing us to prompt for documentation

      # Look for signals that debugging occurred:
      # - ops-debugger agent was used
      # - Database queries were run
      # - Resolution steps were provided

      # For now, this is a placeholder - the prompt below will be shown
      # when the hook matches debugging-related conversations
      echo "DEBUGGING_SESSION_DETECTED"
    match_pattern: "Resolution|provider_id|STATUS_|debugging"
---

# Capture Debugging Pattern Hook

This hook fires at the end of debugging sessions to prompt documentation.

## When This Fires

After Claude completes a response that contains:
- "Resolution" steps
- Database field names like "provider_id", "STATUS_"
- The word "debugging"

## What It Prompts

When a new debugging pattern is discovered that doesn't have an existing skill:

```
New debugging pattern detected!

Would you like to:
1. Create a skill for ops-debugger to use next time
2. Document this in compound docs for searchability
3. Skip - this was a one-off issue

The pattern involves: [entity type] stuck in [state] due to [cause]
```

## Integration with Learning Architecture

```
Debugging Session
       ↓
   [Resolution Found]
       ↓
   [Hook Fires]
       ↓
   ┌─────────────────────┐
   │ Prompt: Document?   │
   └─────────────────────┘
       ↓
   ┌─────────────┬────────────┐
   │   Skill     │  Compound  │
   │  (for ops-  │   Docs     │
   │  debugger)  │ (search)   │
   └─────────────┴────────────┘
```

## Creating a New Skill

If user chooses to create a skill:

1. Extract the pattern:
   - Entity type (Order, User, Task, etc.)
   - Stuck state (CANCELLED, ERROR, SUBMITTED, etc.)
   - Root cause (wrong ID, webhook failure, race condition, etc.)
   - Resolution steps (SQL updates, task re-runs, admin actions)

2. Create skill file at:
   `~/.claude/plugins/platform-tools/skills/{entity}-{issue-type}.md`

3. Follow the skill template:
   ```markdown
   ---
   name: {entity}-{issue-type}
   description: Apply when debugging {entity} issues with {symptom}
   ---

   # {Entity} {Issue Type} Debugging Skill

   ## Quick Diagnosis
   [Query to identify the issue]

   ## Resolution
   [Step-by-step fix]

   ## Verification
   [How to confirm it's fixed]

   ## Root Cause Reference
   [Why this happens]
   ```
