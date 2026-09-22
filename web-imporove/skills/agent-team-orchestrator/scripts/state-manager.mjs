/**
 * state-manager.mjs — Persists and restores team state across sessions.
 *
 * State includes: active goals, in-progress tasks, agent assignments, phase progress.
 * Enables resume capability: if the orchestrator crashes mid-session, it can pick up where it left off.
 *
 * Usage:
 *   node state-manager.mjs save    # Save current state to disk
 *   node state-manager.mjs restore # Restore last saved state
 *   node state-manager.mjs status  # View current in-memory state summary
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const STATE_FILE = resolve(process.env.TEAM_STATE_FILE || "team-state.json");

/**
 * Create a fresh empty state object.
 * @returns {Object} New state
 */
export function createInitialState() {
  return {
    version: "1.0.0",
    created_at: new Date().toISOString(),
    last_updated: null,
    active_goal: null,
    current_phase: null,
    phases_completed: [],
    tasks: {},
    approvals: {},
    budget_snapshot: null,
    hard_stop: false,
    metadata: {},
  };
}

/**
 * Load the persisted state file or create a new one.
 * @returns {Object} Current state
 */
export function loadState() {
  if (existsSync(STATE_FILE)) {
    const raw = readFileSync(STATE_FILE, "utf-8");
    const state = JSON.parse(raw);
    if (!state.version) {
      state.version = "1.0.0";
    }
    return state;
  }
  return createInitialState();
}

/**
 * Save state to disk atomically.
 * @param {Object} state - Updated state object
 */
export async function saveState(state) {
  const fs = await import("fs/promises");
  state.last_updated = new Date().toISOString();
  const tmpFile = STATE_FILE + ".tmp";
  writeFileSync(tmpFile, JSON.stringify(state, null, 2), "utf-8");
  await fs.default.rename(tmpFile, STATE_FILE);
  return state;
}

/**
 * Set the active goal.
 * @param {Object} goal - Goal object from goal-parser
 * @returns {Object} Updated state
 */
export function setActiveGoal(state, goal) {
  state.active_goal = {
    id: goal.id || crypto.randomUUID(),
    title: goal.title,
    description: goal.description,
    target: goal.target,
    priority: goal.priority,
    accepted_criteria: goal.accepted_criteria || [],
    parsed_at: goal.parsed_at || new Date().toISOString(),
  };
  return state;
}

/**
 * Set the current execution phase.
 * @param {string} phaseName - Phase identifier (e.g., "B3")
 * @returns {Object} Updated state
 */
export function setCurrentPhase(state, phaseName) {
  state.current_phase = phaseName;
  return state;
}

/**
 * Mark a phase as completed.
 * @param {string} phaseName - Phase identifier
 * @returns {Object} Updated state
 */
export function completePhase(state, phaseName) {
  if (!state.phases_completed.includes(phaseName)) {
    state.phases_completed.push({
      name: phaseName,
      completed_at: new Date().toISOString(),
    });
  }
  return state;
}

/**
 * Register a task in the state.
 * @param {Object} taskSpec - Task specification from planner
 * @returns {Object} Updated state
 */
export function registerTask(state, taskSpec) {
  state.tasks[taskSpec.id] = {
    id: taskSpec.id,
    goal_id: taskSpec.goal_id,
    agent_role: taskSpec.agent_role,
    description: taskSpec.description,
    status: "pending",
    accepted_criteria: taskSpec.accepted_criteria || [],
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    result: null,
  };
  return state;
}

/**
 * Update task status and optionally set result.
 * @param {string} taskId - Task ID
 * @param {string} status - New status: pending, routed, executing, completed, failed, cancelled
 * @param {Object|null} result - Task result object (optional)
 * @returns {Object} Updated state
 */
export function updateTaskStatus(state, taskId, status, result) {
  const task = state.tasks[taskId];
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  task.status = status;
  if (status === "executing") {
    task.started_at = new Date().toISOString();
  } else if (status === "completed" || status === "failed" || status === "cancelled") {
    task.completed_at = new Date().toISOString();
  }
  if (result !== undefined && result !== null) {
    task.result = result;
  }
  return state;
}

/**
 * Display current state summary.
 */
export function printStatus() {
  const state = loadState();
  console.log("Team State:");
  console.log(`  Version:     ${state.version}`);
  console.log(`  Created:     ${state.created_at}`);
  console.log(`  Last updated:${state.last_updated || "never"}`);
  console.log(`  Active goal: ${state.active_goal?.title || "none"}`);
  console.log(`  Current phase: ${state.current_phase || "none"}`);
  console.log(`  Phases completed: ${state.phases_completed.length}`);
  console.log(`  Registered tasks: ${Object.keys(state.tasks).length}`);
  console.log(`  Hard stop:   ${state.hard_stop ? "YES" : "NO"}`);

  if (Object.keys(state.tasks).length > 0) {
    const byStatus = {};
    for (const task of Object.values(state.tasks)) {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
    }
    console.log("  Task breakdown:");
    for (const [status, count] of Object.entries(byStatus)) {
      console.log(`    ${status}: ${count}`);
    }
  }
}

/**
 * Main CLI entry point.
 */
export async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--save")) {
    // Parse command-line overrides into state
    const state = loadState();
    const goalIdx = args.indexOf("--goal-id");
    if (goalIdx !== -1) {
      state.metadata.saved_goal_id = args[goalIdx + 1];
    }
    const phaseIdx = args.indexOf("--phase");
    if (phaseIdx !== -1) {
      state.metadata.saved_phase = args[phaseIdx + 1];
    }
    await saveState(state);
    console.log("State saved.");
    return;
  }

  if (args.includes("--restore")) {
    const state = loadState();
    if (state.created_at === state.last_updated && !state.active_goal) {
      console.log("No previous state to restore (fresh state returned).");
    } else {
      console.log(JSON.stringify(state, null, 2));
    }
    return;
  }

  if (args.includes("--status")) {
    printStatus();
    return;
  }

  console.error("Usage:");
  console.error("  state-manager.mjs save    [--goal-id <id>] [--phase <name>]");
  console.error("  state-manager.mjs restore");
  console.error("  state-manager.mjs status");
  process.exit(1);
}

if (process.argv[1] && process.argv[1].endsWith("state-manager.mjs")) {
  main();
}
