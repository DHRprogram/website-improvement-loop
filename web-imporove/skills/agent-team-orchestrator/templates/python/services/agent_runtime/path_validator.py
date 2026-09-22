"""Path security validator — enforces allowed_paths per-agent constraints."""

import fnmatch
from pathlib import PurePosixPath
import logging

logger = logging.getLogger(__name__)


class PathValidator:
    """Prevent agents from writing outside their authorized scope."""

    def __init__(self, allowed_paths: list[str]):
        self.allowed_globs = [p.rstrip("/") + "/" + "**" for p in allowed_paths]
        self.directories = set(p.rstrip("/") for p in allowed_paths)

    def validate_path(self, requested_path: str) -> None:
        clean = str(PurePosixPath(requested_path)).lstrip("/")
        for glob in self.allowed_globs:
            if fnmatch.fnmatch(clean, glob):
                logger.info("Path %s matches glob %s", requested_path, glob)
                return
        raise ValueError(
            f"Access denied: {requested_path} not in allowed paths: {self.allowed_globs}"
        )

    async def validate_writes(self, planned_writes: list[dict]) -> None:
        """Validate all planned file writes before execution."""
        for write in planned_writes:
            path = write.get("path", "")
            action = write.get("action", "write")
            if action in ("write", "edit"):
                self.validate_path(path)

    def validate_directory(self, dir_path: str) -> bool:
        clean = str(PurePosixPath(dir_path)).rstrip("/").lstrip("/")
        return any(dir_path.startswith(d) for d in self.directories)
