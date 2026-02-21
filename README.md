# Agentic Tooling

Claude Code plugins, agents, and MCP servers for platform engineering teams.

## Plugins

| Plugin | Description |
|--------|-------------|
| [platform-tools](plugins/platform-tools/) | Production debugging agents, ops skills, and example partner API MCP server |

## Installation

1. Open Claude Code and run `/plugin`
2. Navigate to **Marketplaces** → **Add marketplace**
3. Enter: `ruminaider/agentic-tooling`
4. Go back to **Available** tab and install `platform-tools`

### After installation

Install MCP server dependencies:

```bash
cd ~/.claude/plugins/platform-tools/mcp-servers/example-partner-api && npm install
```

Set required environment variables in your shell profile:

```bash
export PARTNER_API_KEY="your-key-here"
```

Restart Claude Code to pick up the MCP server.

### Updating

After new changes are pushed to this repo:

1. Run `/plugin` → **Marketplaces** → select `agentic-tooling` → **Update**
2. Reinstall the plugin from the **Available** tab

## Repository Structure

```
agentic-tooling/
└── plugins/
    └── platform-tools/             # Debugging agents, ops skills, MCP servers
        ├── agents/                 # alert-investigator, ops-debugger, code-reviewer, etc.
        ├── skills/                 # investigate
        ├── mcp-servers/            # example-partner-api
        └── hooks/
```

See each plugin's README for detailed documentation.
