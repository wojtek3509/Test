# Test

## Exchange bot

Bot na Discorda do exchange'u z ticketami na Components V2 znajdziesz w [`exchange-bot/`](exchange-bot/README.md).

## Claude Code plugins

`.claude/settings.json` registers these marketplaces and plugins for everyone working in this repo. Claude Code asks you to trust and install them the first time you open the project.

| Plugin | Source | What it adds |
| --- | --- | --- |
| `document-skills` | [anthropics/skills](https://github.com/anthropics/skills) | Skills for xlsx, docx, pptx and pdf files |
| `example-skills` | [anthropics/skills](https://github.com/anthropics/skills) | skill-creator, mcp-builder, webapp-testing, canvas-design and others |
| `frontend-design` | [anthropics/claude-code](https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design) | Frontend design skill for polished UIs |
| `security-guidance` | [anthropics/claude-code](https://github.com/anthropics/claude-code/tree/main/plugins/security-guidance) | Hook that warns about insecure code patterns when editing files |

Manual install:

```
/plugin marketplace add anthropics/skills
/plugin marketplace add anthropics/claude-code
/plugin install document-skills@anthropic-agent-skills
/plugin install example-skills@anthropic-agent-skills
/plugin install frontend-design@claude-code-plugins
/plugin install security-guidance@claude-code-plugins
```

### Claude Code Complete Setup

[arturo-ebuck/claude-code-complete-setup](https://github.com/arturo-ebuck/claude-code-complete-setup) is not a plugin. It is a `setup.sh` script for WSL2/Ubuntu that configures your whole machine (MCP servers, API keys, global `~/.claude` files), so it can't be added to a repo. To use it, clone it and run it on your own machine:

```
git clone https://github.com/arturo-ebuck/claude-code-complete-setup.git
cd claude-code-complete-setup
./setup.sh
```
