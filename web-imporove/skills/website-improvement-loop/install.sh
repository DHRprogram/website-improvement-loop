#!/usr/bin/env bash
# Install the website-improvement-loop skill and its slash commands into a
# Claude Code home directory. Safe to re-run: an existing install is moved
# aside, never deleted.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_HOME_DIR="${CLAUDE_HOME:-$HOME/.claude}"
SKILLS_DIR="$CLAUDE_HOME_DIR/skills"
COMMANDS_DIR="$CLAUDE_HOME_DIR/commands/web-improvement-loop"
TARGET_SKILL="$SKILLS_DIR/website-improvement-loop"
STAMP="$(date -u +%Y%m%d-%H%M%S)"

if [ ! -d "$SRC/agents" ]; then
  echo "error: $SRC is not the skill root (no agents/ directory)" >&2
  exit 1
fi

echo "=== website-improvement-loop installer ==="
echo "source: $SRC"
echo "target: $TARGET_SKILL"

# Preserve whatever is already installed so a bad upgrade is always undoable.
if [ -e "$TARGET_SKILL" ]; then
  BACKUP="$TARGET_SKILL.bak.$STAMP"
  echo "existing install found -> $BACKUP"
  mv "$TARGET_SKILL" "$BACKUP"
fi

mkdir -p "$SKILLS_DIR"
cp -R "$SRC" "$TARGET_SKILL"
if [ -d "$TARGET_SKILL/.git" ]; then rm -rf "$TARGET_SKILL/.git"; fi
if [ -d "$TARGET_SKILL/node_modules" ]; then rm -rf "$TARGET_SKILL/node_modules"; fi
find "$TARGET_SKILL" -name '.DS_Store' -delete 2>/dev/null || true

# Commands: prefer the repo copy, fall back to the copy shipped in the skill.
INSTALLED_CMDS=0
REPO_CMDS="$SRC/../../.claude/commands/web-improvement-loop"
SHIP_CMDS="$SRC/commands/web-improvement-loop"
if [ -d "$REPO_CMDS" ]; then
  mkdir -p "$COMMANDS_DIR"
  cp "$REPO_CMDS"/*.md "$COMMANDS_DIR"/
  INSTALLED_CMDS=$(find "$COMMANDS_DIR" -maxdepth 1 -name '*.md' | wc -l | tr -d ' ')
  echo "commands: $COMMANDS_DIR ($INSTALLED_CMDS files)"
elif [ -d "$SHIP_CMDS" ]; then
  mkdir -p "$COMMANDS_DIR"
  cp "$SHIP_CMDS"/*.md "$COMMANDS_DIR"/
  INSTALLED_CMDS=$(find "$COMMANDS_DIR" -maxdepth 1 -name '*.md' | wc -l | tr -d ' ')
  echo "commands: $COMMANDS_DIR ($INSTALLED_CMDS files, from the skill bundle)"
else
  echo "commands: none found — the skill is installed but has no slash commands"
fi

chmod +x "$TARGET_SKILL/install.sh" 2>/dev/null || true
find "$TARGET_SKILL/hooks" "$TARGET_SKILL/scripts" -name '*.sh' -exec chmod +x {} + 2>/dev/null || true
find "$TARGET_SKILL/scripts" -name '*.mjs' -exec chmod +x {} + 2>/dev/null || true

# Optional MCP browser drivers, needed by Phase B.
if command -v npx >/dev/null 2>&1; then
  MCP_TARGET="$CLAUDE_HOME_DIR/.mcp.json"
  if [ ! -f "$MCP_TARGET" ] && [ -f "$TARGET_SKILL/.mcp.json" ]; then
    cp "$TARGET_SKILL/.mcp.json" "$MCP_TARGET"
    echo "mcp: $MCP_TARGET"
  else
    echo "mcp: left alone (already present)"
  fi
else
  echo "mcp: npx not found — skipped. Phase B needs a browser driver."
fi

cat <<'TAIL'

Installed.

Next:
  1. Restart Claude Code
  2. /web-improvement-loop:help
  3. /web-improvement-loop:full --focus=full

Phase B needs a real browser. Check the driver with:
  npx -y chrome-devtools-mcp@latest --help

To uninstall, remove ~/.claude/skills/website-improvement-loop and
~/.claude/commands/web-improvement-loop.
TAIL
