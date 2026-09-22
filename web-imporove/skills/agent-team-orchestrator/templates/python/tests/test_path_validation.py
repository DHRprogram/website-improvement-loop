"""Tests for path_validator — security boundary enforcement."""

import pytest
from services.agent_runtime.path_validator import PathValidator


@pytest.fixture
def validator():
    return PathValidator(allowed_paths=["src/frontend/components", "tests"])


def test_allowed_path_passes(validator):
    validator.validate_path("src/frontend/components/Button.tsx")


def test_subdirectory_allowed(validator):
    validator.validate_path("src/frontend/components/auth/Login.tsx")


def test_outside_allowed_rejected(validator):
    with pytest.raises(ValueError) as exc_info:
        validator.validate_path("/etc/passwd")
    assert "Access denied" in str(exc_info.value)


def test_root_write_rejected(validator):
    with pytest.raises(ValueError):
        validator.validate_path("/root/secrets.json")


def test_tilde_path_rejected(validator):
    with pytest.raises(ValueError):
        validator.validate_path("~/.ssh/id_rsa")


def test_dot_env_rejected(validator):
    with pytest.raises(ValueError):
        validator.validate_path(".env")
    with pytest.raises(ValueError):
        validator.validate_path("config/.env.local")


@pytest.fixture
def wide_validator():
    return PathValidator(allowed_paths=["src/**"])


def test_wide_glob_allows_deep(srcs=[]):
    v = wide_validator
    v.validate_path("src/a/b/c/d/file.py")
