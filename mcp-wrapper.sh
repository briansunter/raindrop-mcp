#!/bin/bash
# Wrapper script for raindrop-mcp to work around Claude Code env var bug
# See: https://github.com/anthropics/claude-code/issues/1254
export RAINDROP_TOKEN="${RAINDROP_TOKEN:-}"
exec bunx @briansunter/raindrop-mcp@latest
