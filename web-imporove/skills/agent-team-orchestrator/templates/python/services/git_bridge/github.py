"""GitHub API client with draft-only PR creation."""

import httpx
import os
import logging

logger = logging.getLogger(__name__)

class GitHubClient:
    """Interact with GitHub API for branch management and PR creation."""

    def __init__(self):
        self.token = os.environ.get("GITHUB_TOKEN", "")
        self.api_url = os.environ.get("GITHUB_API_URL", "https://api.github.com")
        self.repo = os.environ.get("GITHUB_REPOSITORY", "owner/repo")

    async def create_branch(self, base_ref: str, new_branch: str) -> dict:
        ref_url = f"{self.api_url}/repos/{self.repo}/git/ref"
        async with httpx.AsyncClient() as client:
            resp = await client.post(ref_url, headers=self._headers(), json={
                "ref": f"refs/heads/{new_branch}",
                "sha": (await self._get_ref_sha(base_ref))[:40],
            })
            if resp.status_code == 201:
                return resp.json()
            logger.error("Failed to create branch %s: %s", new_branch, resp.text)
            raise RuntimeError(f"Branch creation failed: {resp.status_code}")

    async def _get_ref_sha(self, ref: str) -> str:
        url = f"{self.api_url}/repos/{self.repo}/git/ref/refs%2Fheads%2F{ref}"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=self._headers())
            data = resp.json()
            return data["object"]["sha"]

    async def commit_files(self, branch: str, files_to_add: list[dict], message: str) -> str:
        tree_result = []
        for f in files_to_add:
            content = f["content"].encode().decode('unicode_escape').encode('utf-8').decode()
            import base64
            encoded = base64.b64encode(f["content"].encode()).decode()
            tree_result.append({
                "path": f["path"], "mode": "100644", "type": "blob", "content": content,
            })
        return ""  # Simplified — full impl uses nested tree API

    async def create_draft_pr(
        self, head: str, base: str, title: str, body: str = ""
    ) -> dict:
        """Always creates DRAFT PRs — never auto-merge or push to main."""
        pr_url = f"{self.api_url}/repos/{self.repo}/pulls"
        payload = {
            "title": title,
            "head": head,
            "base": base,
            "body": body,
            "draft": True,  # HARDCODED: all PRs are drafts
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(pr_url, headers=self._headers(), json=payload)
            if resp.status_code == 201:
                data = resp.json()
                logger.info("Created draft PR #%d: %s", data["number"], data["html_url"])
                return data
            logger.error("PR creation failed: %s", resp.text)
            raise RuntimeError(f"PR creation failed: {resp.status_code}")

    def _headers(self) -> dict:
        return {
            "Authorization": f"token {self.token}",
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
