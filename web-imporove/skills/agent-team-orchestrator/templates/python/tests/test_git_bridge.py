"""Tests for git_bridge — branch naming and PR templates."""

import pytest
from services.git_bridge.branch_manager import generate_branch_name, BranchManager
from services.git_bridge.pr_template import get_template


def test_branch_name_contains_prefix():
    name = generate_branch_name(prefix="feat", goal_title="add login page")
    assert name.startswith("feat/")


def test_branch_name_is_lowercase():
    name = generate_branch_name(goal_title="Add Feature")
    assert name == name.lower()


def test_branch_name_has_short_hash():
    name = generate_branch_name(goal_title="Test goal")
    # Format: prefix/goal-text-8-char-hash
    parts = name.split("-")
    assert len(parts[-1]) == 8


def test_branch_manager_registers_and_retrieves():
    bm = BranchManager()
    bm.register_branch("goal-123", "feat/dashboard-refactor-abc12345")
    assert bm.get_branch("goal-123") == "feat/dashboard-refactor-abc12345"
    assert bm.get_branch("nonexistent") is None


def test_frontend_template_exists():
    t = get_template("frontend")
    assert len(t) > 50
    assert "Components Modified" in t


def test_designer_template_exists():
    t = get_template("designer")
    assert "Accessibility Review" in t


def test_backend_template_exists():
    t = get_template("backend")
    assert "API Changes" in t


def test_unknown_role_returns_fallback():
    t = get_template("unknown-role")
    assert len(t) > 0  # Should return something, not crash


def test_qa_template_mentions_tests():
    t = get_template("qa")
    assert "Tests Run" in t or "coverage" in t.lower()
