#!/usr/bin/env bash
set -euo pipefail

REPO="DHRprogram/website-improvement-loop"
SKILL_DIR="${HOME}/.claude/skills/website-improvement-loop"

echo "==> Installing website-improvement-loop skill..."

# Clone or pull
if [ -d "$SKILL_DIR/.git" ]; then
  cd "$SKILL_DIR" && git pull
else
  mkdir -p "$(dirname "$SKILL_DIR")"
  git clone "https://github.com/$REPO.git" "$SKILL_DIR"
fi

# Symlink the slash command
mkdir -p "${HOME}/.claude/commands"
ln -sf "${SKILL_DIR}/commands/improve-site.md" "${HOME}/.claude/commands/improve-site.md"

# Install npm deps
cd "$SKILL_DIR"
if [ -f package.json ]; then
  npm install --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund --ignore-scripts 2>/dev/null || true
fi

echo ""
echo "==> Done! Use /improve-site to start."
echo ""
echo "Optional:"
echo "  cp ${SKILL_DIR}/examples/github-workflow.yml .github/workflows/regression.yml"
