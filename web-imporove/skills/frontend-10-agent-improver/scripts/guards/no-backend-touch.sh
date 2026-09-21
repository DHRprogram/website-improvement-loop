#!/usr/bin/env bash
set -euo pipefail

echo "=== Guard: No Backend Touch ==="

# Check changed files (staged + working tree)
CHANGED_FILES=$(git diff --cached --name-only 2>/dev/null || true)
CHANGED_FILES="$CHANGED_FILES
$(git diff --name-only 2>/dev/null || true)"

VIOLATIONS=0

# Blocked directory patterns
BLOCKED_DIRS="(^|/)server/|^api/|^backend/|^db/|^migrations/|^prisma/|^models/|^/server|^/api|^/backend|^/db|^/migrations|^/prisma|^/models"

# Blocked file patterns
BLOCKED_FILES="\.sql$|schema\.|migrate\.|seed\.|migration\.|\.orm\.|\.entity\.|\.repository\.|\.dao\.|\.dto\.|\.middleware\.|\.guard\.|\.filter\.|\.interceptor\.|\.decorator\.|\.pipe\.|\.module\.|\.controller\.|\.resolver\.|\.service\.|\.provider\.|\.injectable\.|\.datasource\.|\.datamapper\.|\.entity\.ts$|\.repository\.ts$"

# Blocked backend package imports
BLOCKED_DEPS="express|fastify|koa|nest|prisma|drizzle|typeorm|sequelize|mongoose|redis|knex|bottleneck|amqplib|kafka-node|ioredis|passport|jsonwebtoken|cookie-parser|body-parser|cors|crypto-js|bcrypt|argon2"

for FILE in $CHANGED_FILES; do
  [ -z "$FILE" ] && continue

  # Check directory patterns
  if echo "$FILE" | grep -qE "$BLOCKED_DIRS"; then
    echo "  VIOLATION: $FILE matches blocked directory pattern"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi

  # Check file patterns
  if echo "$FILE" | grep -qE "$BLOCKED_FILES"; then
    echo "  VIOLATION: $FILE matches blocked file pattern"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

# Check for backend package imports in package.json (if changed)
if echo "$CHANGED_FILES" | grep -q "package.json"; then
  if [ -f package.json ]; then
    PKG_CONTENT=$(cat package.json)
    if echo "$PKG_CONTENT" | grep -qE "\"(express|fastify|koa|nest|prisma|drizzle|typeorm|sequelize|mongoose|redis)\""; then
      echo "  VIOLATION: Backend dependency found in package.json"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  fi
fi

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "FAIL: $VIOLATIONS backend violations detected. Frontend-only rule enforced."
  exit 1
fi

echo "PASS: No backend files touched."
exit 0
