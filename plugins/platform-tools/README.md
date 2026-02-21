# Platform Tools Plugin

Production debugging, ops, and alert investigation tools for Claude Code.

## Version

0.3.0

## Agents

| Agent | Description |
|-------|-------------|
| `alert-investigator` | PagerDuty/NewRelic alert investigation with root cause analysis |
| `ops-debugger` | Entity state debugging, webhook failures, admin action issues |
| `queue-investigator` | Queue starvation, job throughput anomalies, worker health |
| `code-reviewer` | Persona-based code review with strict clarity, type safety, and test quality standards |
| `verify-root-cause` | Hypothesis verification subagent (internal use) |

## Skills

| Skill | Description |
|-------|-------------|
| `investigate` | Comprehensive ops investigation for reported bugs |

## MCP Servers

The plugin ships MCP server code in `mcp-servers/`. These are **not auto-registered** — you need to add them to your project's `.mcp.json` after installing the plugin.

| Server | Description | Tools |
|--------|-------------|-------|
| `example-partner-api` | Read-only partner API access | `partner__get_resource`, `partner__list_resources` |

### Setup

1. Install dependencies:

```bash
cd ~/.claude/plugins/platform-tools/mcp-servers/example-partner-api && npm install
```

2. Add the server to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "example-partner-api": {
      "type": "stdio",
      "command": "node",
      "args": ["~/.claude/plugins/platform-tools/mcp-servers/example-partner-api/index.js"],
      "env": {
        "PARTNER_API_KEY": "your-key-here",
        "PARTNER_API_URL": "https://api.example.com"
      }
    }
  }
}
```

3. Restart Claude Code to pick up the new MCP server.

## Usage

```
# Invoke via Task tool
Task(subagent_type="platform-tools:ops-debugger", prompt="Debug this issue...")
Task(subagent_type="platform-tools:alert-investigator", prompt="Investigate this alert...")
```

## Directory Structure

```
platform-tools/
├── .claude-plugin/
│   └── plugin.json         # Plugin metadata
├── agents/
│   ├── alert-investigator.md
│   ├── code-reviewer.md
│   ├── ops-debugger.md
│   ├── queue-investigator.md
│   └── verify-root-cause.md
├── hooks/
│   └── capture-debugging-pattern.md
├── mcp-servers/
│   └── example-partner-api/
│       ├── index.js        # MCP server implementation
│       └── package.json    # Node.js dependencies
├── skills/
│   └── investigate/
│       └── SKILL.md
├── .gitignore
└── README.md
```

## Expected Behavior

### How it works with systematic-debugging

The `ops-debugger` and `alert-investigator` agents are designed to work naturally with the `systematic-debugging` skill from superpowers. When a user asks Claude to debug an issue, Claude will typically:

1. **Invoke systematic-debugging skill first** - Provides debugging methodology and philosophy
2. **Then invoke the appropriate platform-tools agent** - Provides platform-specific execution with MCP tools

No explicit coordination is needed. Claude composes them naturally based on clear descriptions in each tool's metadata.

### Key insight

The integration works when both components have clear triggering descriptions. The composition emerges from well-written tool descriptions that make their purpose clear.

## Plugin Development Notes

This plugin follows the Claude Code local-custom-plugins format. Key learnings:

### Agent Frontmatter Format (CRITICAL)

**WRONG - Multi-line YAML block scalar:**
```yaml
description: |
  Use this agent when...

  <example>
  ...
  </example>
```

**CORRECT - Single-line with \n escapes:**
```yaml
description: Use this agent when debugging operational issues...\n\n<example>\nContext: User shares a Slack/Notion link\nuser: "Debug this issue..."\nassistant: "I'll use the ops-debugger agent..."\n<commentary>\nThis triggers the ops-debugger because...\n</commentary>\n</example>
```

### Skills Structure (CRITICAL)

**WRONG:**
```
skills/
└── my-skill.md          # Won't load
```

**CORRECT:**
```
skills/
└── my-skill/
    └── SKILL.md              # Will load
```

### Model Specification

Use explicit model names, not `inherit`:
- `opus` - For complex investigation
- `sonnet` - For balanced tasks
- `haiku` - For quick tasks

### Debugging

Run Claude with `--debug` flag to see plugin loading:
```bash
claude --debug 2>&1 | tee debug.log
```

Look for:
- `Loaded N agents from plugin X default directory`
- `Loaded N skills from plugin X default directory`
- Any marketplace or registration errors

### Recommended: Use plugin-dev

Install the official plugin development plugin for guidance:
```bash
claude plugin install plugin-dev@claude-plugins-official
```
