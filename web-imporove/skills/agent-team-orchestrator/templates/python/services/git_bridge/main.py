from __future__ import annotations

"""Git Bridge service — FastAPI wrapping the GitHub REST API.

CRITICAL RULE:
    ALL pull requests are opened as drafts (draft=True).
    This service NEVER merges, closes, or force-pushes anything.
    Human approval in control_room is required before any merge.
"""
"""Git Bridge service — FastAPI wrapper around GitHub API.

Endpoint: POST /pr {repo_id, task, files, branch}

CRITICAL RULES:
    - ALWAYS opens DRAFT PRs only (draft=True on create_pull)
    - NEVER calls merge(), close(), or push_to_main()
    - NEVER pushes directly to main/master branch
    - All branches created from main for isolation
    - Human must review and approve before any merge occurs
"""


import logging
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

app = FastAPI(title="Git Bridge", version="1.0.0")


class CreatePRRequest(BaseModel):
    repo_owner: str = Field(..., min_length=1)
    repo_name: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1, max_length=512)
    description: str = Field(default="", max_length=10000)
    branch: str = Field(..., pattern=r"^[a-zA-Z0-9_/.-]+$")
    base_branch: str = Field(default="main", pattern=r"^[a-zA-Z0-9_/.-]+$")
    files: list[dict[str, str]] = Field(default_factory=list)
    task_id: str = Field(default="")


class CreatePRResponse(BaseModel):
    pr_url: str
    draft: bool = True
    number: int
    branch: str


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/metrics")
async def metrics() -> dict[str, Any]:
    """Prometheus-style metrics endpoint."""
    return {"pr_created_total": 0, "pr_merged_total": 0}


@app.post("/pr", response_model=CreatePRResponse)
async def create_pr(request: CreatePRRequest) -> CreatePRResponse:
    """Open a DRAFT pull request.

    SECURITY: This function ONLY opens draft PRs. It contains NO code paths that:
        - Call pull_request.merge()
        - Push directly to the target branch
        - Delete any remote refs
        - Force-push existing branches

    The merge step is exclusively handled by human approval in control_room.
    """
    github_token = _get_github_token()
    owner = request.repo_owner
    name = request.repo_name

    # Build branch name unique to this task
    branch_name = f"skill-b/auto/{request.branch}"
    if request.task_id:
        branch_name += f"-{request.task_id}"

    try:
        import httpx

        # Step 1: Get the latest commit hash from base branch
        headers = {"Authorization": f"token {github_token}", "Accept": "application/vnd.github.v3+json"}
        async with httpx.AsyncClient() as client:
            commits_resp = await client.get(
                f"https://api.github.com/repos/{owner}/{name}/commits",
                params={"sha": request.base_branch, "per_page": 1},
                headers=headers,
            )
            commits_resp.raise_for_status()
            latest_commit_sha = commits_resp.json()[0]["sha"]

        # Step 2: Create the new branch from base
        ref_data = {
            "ref": f"refs/heads/{branch_name}",
            "sha": latest_commit_sha,
        }
        async with httpx.AsyncClient() as client:
            ref_resp = await client.post(
                f"https://api.github.com/repos/{owner}/{name}/git/refs",
                json=ref_data,
                headers=headers,
            )
            ref_resp.raise_for_status()

        # Step 3: Commit files to the new branch
        for file_entry in request.files:
            file_path = file_entry["path"]
            content = file_entry["content"]
            import base64 as _b64

            encoded_content = _b64.b64encode(content.encode("utf-8")).decode("utf-8")
            commit_data = {
                "path": file_path,
                "message": f"[skill-b] Task {request.task_id}: {file_path}",
                "content": encoded_content,
                "branch": branch_name,
            }
            async with httpx.AsyncClient() as client:
                commit_resp = await client.put(
                    f"https://api.github.com/repos/{owner}/{name}/contents/{file_path}",
                    json=commit_data,
                    headers=headers,
                )
                commit_resp.raise_for_status()

        # Step 4: CREATE DRAFT PULL REQUEST — NEVER merge here
        pr_body_parts: list[str] = [f"**Task:** {request.task_id}", "", f"**Branch:** `{branch_name}`"]
        if request.description:
            pr_body_parts.append(f"## Description\n\n{request.description}")
        pr_body_parts.append("\n---\n*Opened automatically by skill-b git_bridge. **DO NOT MERGE** without human review.*")

        pr_payload = {
            "title": request.title,
            "body": "\n".join(pr_body_parts),
            "head": branch_name,
            "base": request.base_branch,
            "draft": True,  # CRITICAL: always draft
        }
        async with httpx.AsyncClient() as client:
            pr_resp = await client.post(
                f"https://api.github.com/repos/{owner}/{name}/pulls",
                json=pr_payload,
                headers=headers,
            )
            pr_resp.raise_for_status()
            pr_json = pr_resp.json()

        return CreatePRResponse(
            pr_url=pr_json["html_url"],
            draft=True,
            number=pr_json["number"],
            branch=branch_name,
        )

    except Exception as exc:
        logger.exception("Failed to create PR for %s/%s", owner, name)
        raise HTTPException(status_code=500, detail=str(exc))


def _get_github_token() -> str:
    token = os.environ.get("GITHUB_TOKEN", "")
    if not token:
        raise RuntimeError("GITHUB_TOKEN environment variable is not set")
    return token
