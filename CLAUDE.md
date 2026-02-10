# Claude Code Instructions - MarketPulse

**Project:** MarketPulse (Telegram Bot + n8n Workflows)
**Repository:** creator35lwb-web/MarketPulse (PRIVATE)
**Command Central Hub:** creator35lwb-web/verifimind-genesis-mcp

---

## MACP Integration

This project is coordinated via Command Central Hub (verifimind-genesis-mcp).

### Session Start: Check MACP Inbox

At the start of every session, check for pending tasks:

Use the `macp_read_messages` MCP tool with:
- repository: `creator35lwb-web/verifimind-genesis-mcp`
- filters.to: `RNA`
- limit: 5

Or run `/macp-inbox`.

### Session End: Create Handoff

Use the `macp_create_handoff` MCP tool with:
- repository: `creator35lwb-web/verifimind-genesis-mcp`
- agent: `RNA`
- session_type: `development`
- All required fields (completed, decisions, artifacts, pending, blockers, next_agent)

---

## Session Start Checklist

When starting a new session, ALWAYS:

1. [ ] Read this CLAUDE.md file
2. [ ] **Check MACP inbox** for pending tasks
3. [ ] Check README.md for project overview
4. [ ] Review recent git log for latest changes

---

## Project Overview

MarketPulse is an automated market intelligence system using:
- **Telegram Bot** for delivery
- **n8n Workflows** for automation
- **VerifiMind-PEAS** for AI validation

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `peas/` | PEAS integration code |
| `workflows/` | n8n workflow definitions |
| `MarketPulse-Secure/` | Security-related configs |
| `docs/` | Documentation |

---

## Development Workflow

```
1. Check MACP inbox for tasks
2. Implement changes locally
3. Test thoroughly
4. Commit with descriptive message
5. Push to origin/main
6. Create handoff record via macp_create_handoff
```

---

## Important Notes

- This repo had secrets scrubbed via BFG (2026-02-10)
- Always check `.gitignore` before committing
- Never commit API keys, tokens, or credentials
- Coordinate with VerifiMind-PEAS for validation features

---

**Protocol:** MACP v2.0 | FLYWHEEL Level 2
