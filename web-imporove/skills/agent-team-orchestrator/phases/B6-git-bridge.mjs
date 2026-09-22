# Phase B6: Git Bridge

Implement the git bridge service (FastAPI + PyGithub) that creates feature branches, commits agent changes, and opens draft PRs — never merging directly.

## Purpose

Provide a reliable, auditable path from sandboxed agent output to version-controlled pull requests. Every PR is opened as DRAFT so a human can review before merging. The bridge tracks which commit each task produced, links back to the task_id via a trailer comment in the commit message, and maintains branch naming conventions for traceability.

## Timing

Runs after B5 (agent runtime) confirms agents produce valid file outputs. Must be operational before B9 (remaining roles) which includes design and security agents that need to create their own artifacts in the repo.

## Inputs

- `shared/event_bus.py` from B1
- `shared/logging.py` structured logging from B1
- Docker Compose stack with git_bridge service running from B2
- Repository URL and authentication token from environment variables

## Outputs

- Branch creation function: `create_branch(source_branch, task_id, agent_role)` returns new branch name formatted as `agent/{agent_role}/{task_id}`
- Commit aggregation function: collects all modified files from a workspace directory, stages them, creates a single commit with structured message template
- Draft PR creation function: `open_draft_pull_request(base_branch, head_branch, title, body, labels)` using PyGithub's ability to set pull request state to DRAFT
- Commit trailer injection: every commit message ends with `\n\nAgent: {role}\nTask: {task_id}\nCorrelation-ID: {correlation_id}` for traceability
- Merge guard: PRs are NEVER auto-merged; only marked ready_for_review by explicit human action

## Steps

1. Implement FastAPI application with endpoints: POST `/api/v1/git/branch`, POST `/api/v1/git/commit`, POST `/api/v1/git/pull-request`, GET `/api/v1/git/status`.
2. Branch endpoint accepts `{source_branch, task_id, agent_role}`, validates source_branch exists on remote, calls GitHub API Create Reference to create `refs/heads/agent/{agent_role}/{task_id}`, returns the new branch name and full ref.
3. Commit endpoint receives `{branch, directory, files, task_id, role, correlation_id, message_prefix}`, iterates over the file list, computes sha256 checksum of each file content, creates a commit object with parent = current HEAD of target branch, message = f"{message_prefix}\n\nAgent: {role}\nTask: {task_id}\nCorrelation-ID: {correlation_id}", creates the commit via GitHub API Create Commit, updates the branch reference to point at the new commit.
4. Pull request endpoint accepts `{base_branch, head_branch, title, body, labels}`, creates a pull request via PyGithub repository.create_pull() with draft=True always. Labels applied after creation via PR.add_to_labels(). Return PR number and URL.
5. Status endpoint returns current branch listing (first 50), open PR count, and commit status for a given branch.
6. Integrate with event bus: subscribe to `task.completed:{task_id}` events. When received with status="completed", extract the list of artifact paths, call create_branch if branch doesn't exist, call commit with those artifacts, call open_draft_pull_request targeting main or the plan-specified base branch.
7. Add retry logic with exponential backoff for GitHub API rate limit handling (403 with retry-after header).
8. Publish `GIT_BRIDGE_READY` event.

## Checklist

- [ ] FastAPI app has four endpoints: POST /branch, POST /commit, POST /pull-request, GET /status
- [ ] Branch endpoint validates source_branch exists before creating
- [ ] Branch naming convention strictly follows agent/{agent_role}/{task_id} pattern
- [ ] Branch endpoint returns {name, full_ref, url} on success
- [ ] Commit endpoint receives a list of file objects each with {path, content}
- [ ] Each file's content gets sha256 checksum computed before staging
- [ ] Commit message uses exact format: "{prefix}\\n\\nAgent: {role}\\nTask: {task_id}\\nCorrelation-ID: {correlation_id}"
- [ ] Commit API call creates commit object with correct SHA parent reference
- [ ] Branch reference updated atomically after commit creation
- [ ] Pull request created with draft=True forced — no way to create non-draft
- [ ] PR labels applied as array of strings from labels parameter
- [ ] PR response includes {number, url, draft: true}
- [ ] Status endpoint returns paginated branch list (max 50) and open PR count
- [ ] Event bus subscriber listens to task.completed topics and triggers branch/commit/PR flow
- [ ] Retry logic handles HTTP 403 with Retry-After header using exponential backoff
- [ ] Initial backoff is 1 second, max retry delay is 60 seconds, max retries is 5
- [ ] All Python files pass py_compile validation
- [ ] GIT_BRIDGE_READY event published to event bus

## Rollback

If the git bridge cannot reach the GitHub API (network failure, auth failure, or quota exhausted), mark the affected tasks as "pending_git" rather than failed. The agent itself completed successfully; only the PR creation step is blocked. Log the failure under topic `git.push_failure` with error detail and task IDs. Do not tear down the sandbox until the human operator decides how to proceed (retry later, switch credential provider, or accept the changes were committed locally only). Never attempt to force-push or overwrite existing branches without explicit operator approval.
