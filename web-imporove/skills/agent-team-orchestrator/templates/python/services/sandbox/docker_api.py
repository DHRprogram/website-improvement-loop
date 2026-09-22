"""Docker API wrapper for container execution."""

import docker
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class DockerAPI:
    """Manage ephemeral sandbox containers with strict security constraints."""

    DEFAULT_CONFIG = {
        "network_disabled": True,
        "read_only_rootfs": True,
        "cap_drop": ["ALL"],
        "tmpfs": {"": ""},
        "mem_limit": "1g",
        "cpus": 2.0,
        "security_opt": ["no-new-privileges:true"],
    }

    def __init__(self, host: str | None = None):
        self.host = host or "unix:///var/run/docker.sock"
        self.client = docker.from_env()

    def create_container(
        self,
        image: str = "python:3.12-slim",
        command: str = "",
        timeout: int = 60,
        workspace_dir: str = "/workspace",
    ) -> tuple[docker.models.containers.Container, dict]:
        config = {**self.DEFAULT_CONFIG}
        container = self.client.containers.run(
            image=image,
            command=command,
            detach=True,
            remove=True,
            **config,
        )
        logger.info("Sandbox container created: %s", container.short_id)
        return container, {"container_id": container.id}

    def wait_for_completion(self, container: docker.models.containers.Container, timeout: int = 60) -> bool:
        try:
            result = container.wait(timeout=timeout)
            return result.get("ExitCode", -1) == 0
        except Exception as e:
            logger.error("Container wait failed: %s", e)
            return False

    def get_logs(self, container: docker.models.containers.Container) -> str:
        return container.logs().decode(errors="replace")

    def stop_and_remove(self, container: docker.models.containers.Container):
        try:
            container.stop(timeout=5)
        except Exception:
            pass
        try:
            container.remove(force=True)
        except Exception:
            pass
