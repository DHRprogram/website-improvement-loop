/**
 * budget-tracker.mjs — Monitors cumulative spend across agent sessions.
 * Tracks total and per-agent token/cost usage against a global cap.
 * Fires HST-B05 (Budget Cap Exceeded) when spending exceeds the approved limit.
 *
 * Usage:
 *   node budget-tracker.mjs --status           Show current spend vs limits
 *   node budget-tracker.mjs --record 4.50      Record USD spent (reads from ENV)
 *   node budget-tracker.mjs --reset             Reset counters after a session
 *   node budget-tracker.mjs --override <cap>    Override hard stop with new cap
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { renameSync } from "node:fs";

const STATE_DIR = process.env.BUDGET_STATE_DIR || "artifacts/agent-team-orchestrator";
const STATE_FILE = resolve(STATE_DIR, "BUDGET.json");
const DEFAULT_CAP_USD = parseFloat(process.env.BUDGET_CAP_USD || "50.00");

/**
 * Load or create the budget state file.
 * @returns {Object} Budget state object
 */
export function loadState() {
  if (existsSync(STATE_FILE)) {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  }

  return {
    version: "1.0.0",
    total_cap_usd: DEFAULT_CAP_USD,
    spent_usd: 0,
    per_agent: {},
    alerts: [],
    overrides: [],
    hard_stop_triggered: false,
    start_time: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  };
}

/**
 * Save budget state to disk atomically (write to temp then rename).
 * Idempotent — calling twice with the same data is safe.
 * @param {Object} state - Updated budget state
 */
export function saveState(state) {
  const tmpFile = STATE_FILE + ".tmp";
  writeFileSync(tmpFile, JSON.stringify(state, null, 2), "utf-8");
  try {
    renameSync(tmpFile, STATE_FILE);
  } catch {
    // Fallback: direct write if rename fails
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  }
}

/**
 * Record a task cost in the budget tracker.
 * @param {Object} params - { taskId?, spentUsd, model?, tokens? }
 * @returns {Object} Updated budget state snapshot
 */
export function recordTask(params) {
  const state = loadState();

  if (state.hard_stop_triggered) {
    throw new Error(
      `Budget hard stop is active. Total spent: $${state.spent_usd.toFixed(2)} of $${state.total_cap_usd.toFixed(2)}. Override required.`
    );
  }

  const cost = Math.round((params.spentUsd || 0) * 100) / 100;
  const projected = Math.round((state.spent_usd + cost) * 100) / 100;

  if (projected > state.total_cap_usd + 0.01) {
    state.hard_stop_triggered = true;
    state.overrides.push({
      type: "hard_stop",
      reason: "Budget exceeded",
      triggered_at: new Date().toISOString(),
      total_spent: projected,
      cap: state.total_cap_usd,
    });
    state.alerts.push({
      type: "HST-B05",
      severity: "critical",
      message: `Spending $${projected.toFixed(2)} exceeds cap $${state.total_cap_usd.toFixed(2)}`,
      time: new Date().toISOString(),
    });
  }

  state.spent_usd = projected;

  if (params.model) {
    if (!state.per_agent[params.model]) {
      state.per_agent[params.model] = { tokens: 0, cost_usd: 0, tasks: 0 };
    }
    state.per_agent[params.model].cost_usd = Math.round(
      (state.per_agent[params.model].cost_usd + cost) * 100
    ) / 100;
    state.per_agent[params.model].tokens += params.tokens || 0;
    state.per_agent[params.model].tasks += 1;
  }

  state.sessions = state.sessions || [];
  state.sessions.push({
    task_id: params.taskId || "unknown",
    spent_usd: cost,
    recorded_at: new Date().toISOString(),
  });

  state.last_updated = new Date().toISOString();

  saveState(state);
  return state;
}

/**
 * Get the current budget status summary.
 * @returns {Object} Status report with remaining, percentage, alert level
 */
export function getStatus() {
  const state = loadState();
  const percentage = state.total_cap_usd > 0
    ? (state.spent_usd / state.total_cap_usd) * 100
    : 0;

  return {
    ...state,
    remaining_usd: Math.max(0, state.total_cap_usd - state.spent_usd),
    percentage_used: Math.round(percentage * 100) / 100,
    alert_level: getAlertLevel(percentage),
  };
}

/**
 * Determine alert level based on percentage used.
 * @param {number} percentage - Percentage of budget used (0-100)
 * @returns {string} Alert level: green, yellow, orange, critical
 */
function getAlertLevel(percentage) {
  if (percentage >= 100) return "critical";
  if (percentage >= 90) return "orange";
  if (percentage >= 75) return "yellow";
  return "green";
}

/**
 * Override a hard stop (human operator action only).
 * @param {string} reason - Reason for override
 * @param {number} [newCap] - New budget cap (optional)
 * @returns {Object} Updated state
 */
export function overrideHardStop(reason, newCap) {
  const state = loadState();

  if (!state.hard_stop_triggered) {
    throw new Error("No hard stop is currently active.");
  }

  if (newCap !== undefined && typeof newCap === "number") {
    state.total_cap_usd = newCap;
  } else {
    state.total_cap_usd = Math.round(state.spent_usd * 1.5 * 100) / 100;
  }

  state.hard_stop_triggered = false;

  state.overrides.push({
    type: "operator_override",
    reason,
    overridden_at: new Date().toISOString(),
    new_cap: state.total_cap_usd,
  });

  state.last_updated = new Date().toISOString();
  saveState(state);
  return state;
}

/**
 * Reset all budget counters (end-of-session cleanup).
 * @returns {Object} Fresh state
 */
export function resetBudget() {
  const fresh = {
    version: "1.0.0",
    total_cap_usd: DEFAULT_CAP_USD,
    spent_usd: 0,
    per_agent: {},
    alerts: [],
    overrides: [],
    hard_stop_triggered: false,
    start_time: new Date().toISOString(),
    reset_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  };
  saveState(fresh);
  return fresh;
}

/**
 * Main CLI entry point.
 */
export async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--status")) {
    const status = getStatus();
    console.log("Budget Status:");
    console.log(`  Cap:        $${status.total_cap_usd.toFixed(2)}`);
    console.log(`  Spent:      $${status.spent_usd.toFixed(2)}`);
    console.log(`  Remaining:  $${status.remaining_usd.toFixed(2)}`);
    console.log(`  Used:       ${status.percentage_used}%`);
    console.log(`  Alert:      ${status.alert_level}`);
    console.log(`  Hard Stop:  ${status.hard_stop_triggered ? "YES" : "NO"}`);
    console.log(`  Sessions:   ${status.sessions?.length || 0}`);
    if (Object.keys(status.per_agent).length > 0) {
      console.log("  Per-agent:");
      for (const [model, stats] of Object.entries(status.per_agent)) {
        console.log(`    ${model}: $${stats.cost_usd.toFixed(2)} (${stats.tokens} tokens, ${stats.tasks} tasks)`);
      }
    }
    return;
  }

  if (args.includes("--reset")) {
    const state = resetBudget();
    console.log(`Budget reset. Cap set to $${state.total_cap_usd.toFixed(2)}`);
    return;
  }

  if (args.includes("--record")) {
    const spentIdx = args.indexOf("--spent");
    const cost = spentIdx !== -1 ? parseFloat(args[spentIdx + 1]) : parseFloat(args[1]) || 0;
    try {
      const state = recordTask({ spentUsd: cost });
      console.log(JSON.stringify({ success: true, spent: state.spent_usd, cap: state.total_cap_usd }, null, 2));
    } catch (err) {
      console.error(`Error recording: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  if (args.includes("--override")) {
    const capIdx = args.indexOf("--cap");
    const reason = args.slice(args.indexOf("--override") + 1).filter(a => !a.startsWith("--cap=") && !a.startsWith("--cap")).join(" ") || "Operator override";
    const capVal = capIdx !== -1 ? parseFloat(args[capIdx + 1]) : undefined;
    const state = overrideHardStop(reason, capVal);
    console.log(`Hard stop overridden. New cap: $${state.total_cap_usd.toFixed(2)}`);
    return;
  }

  console.error("Usage:");
  console.error("  budget-tracker.mjs --status");
  console.error("  budget-tracker.mjs --record --spent <usd>");
  console.error("  budget-tracker.mjs --reset");
  console.error("  budget-tracker.mjs --override --reason <text> [--cap <usd>]");
  process.exit(1);
}

if (process.argv[1] && process.argv[1].endsWith("budget-tracker.mjs")) {
  main().catch(e => { console.error(e); process.exit(1); });
}
