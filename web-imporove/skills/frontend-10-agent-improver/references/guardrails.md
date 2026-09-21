# Guardrails

## Frontend-Only Rule

### NEVER touch:
- **Directories**: /server, /api, /backend, /db, /migrations, /prisma, /models
- **File patterns**: *.sql, schema.*, migrate.*, seed.*, *.entity.ts, *.repository.ts
- **Packages**: express, fastify, koa, nest, prisma, drizzle, typeorm, sequelize, mongoose, redis, knex
- **Infrastructure**: Dockerfile, docker-compose, nginx.conf, .k8s/, terraform, helm

### VIOLATION examples:
```bash
# BAD - this is backend work
api/models/user.entity.ts

# BAD - DB schema change
prisma/schema.prisma

# GOOD - frontend component
src/components/Button.tsx
```

## Revertible Changes

Every change must be one single commit with a revertible message.

### Rules:
1. One finding per commit — never mix agents in one commit.
2. Commit message format: `frontend-loop: [A<N>] <short-title> (metric: <name> <before>-><after>)`
3. If build fails: `git revert HEAD`
4. If metric regresses: `git revert HEAD`
5. Never force push, never rebase main, never amend a pushed commit.

## No Secrets

### Never commit:
- GitHub tokens: github_pat_, ghp_, gho_, ghu_, ghs_, ghr_
- OpenAI keys: sk-
- AWS keys: AKIA
- Private keys: -----BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY
- Credentials: password=, secret=, api_key=
- Connection strings: mysql://, postgres://, mongodb://

### Guard:
The no-secret-commit.sh guard runs on every commit and scans staged changes.

## Metric Integrity

### Rules:
1. Measure BEFORE making any changes.
2. Measure AFTER each commit.
3. If metric regressed >5%, revert.
4. Track metrics over time in STATE.json.

### Key Metrics:
- bundle_kb: Total JS bundle size (gzip)
- build_time_ms: Build duration
- test_pass_rate: Percentage of tests passing
- type_errors: TypeScript error count
- lint_errors: Linter error count
- component_count: Total frontend components
