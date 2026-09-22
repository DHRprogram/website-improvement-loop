"""Container and temp directory cleanup utilities."""

import shutil
import tempfile
import logging
import time

logger = logging.getLogger(__name__)


def cleanup_workspace(temp_dir: str):
    """Remove temporary workspace after task execution."""
    try:
        if temp_dir and __import__("os").path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
            logger.debug("Cleaned up workspace: %s", temp_dir)
    except Exception as e:
        logger.warning("Workspace cleanup failed: %s", e)


async def clean_stale_containers():
    """Remove any stale/hung containers older than threshold."""
    try:
        import docker
        client = docker.from_env()
        cutoff = time.time() - 3600
        for c in client.containers.list(all=True):
            created = max(c.attrs["Created"].timestamp() for _ in range(2))
            if created < cutoff and c.status == "exited":
                c.remove(force=True)
                logger.info("Removed stale container: %s", c.id[:8])
    except Exception as e:
        logger.error("Stale container cleanup failed: %s", e)
