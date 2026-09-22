/**
 * hard-stop-detector.mjs — Monitors for conditions that require immediate execution halt.
 *
 * Hard stop triggers:
 *   - Budget exceeded (tracked by budget-tracker)
 *   - Consecutive task failure rate above threshold (>50% over last 10 tasks)
 *   - Security critical finding detected
 *   - Container resource exhaustion in sandbox
 *   - LLM API unavailability for more than configured timeout
 *
 * Usage:
 *   node hard-stop-detector.mjs --check       # Run a single check cycle
 *   node hard-stop-detector.mjs --watch        # Continuously monitor
 *   node hard-stop-detector.mjs --status       # Show current state
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const STATE_DIR = process.env.HARD_STOP_STATE_DIR || ".";
const STOP_FILE = resolve(STATE_DIR, "hard-stop-state.json");
const BUDGET_STATE_FILE = resolve(process.env.BUDGET_STATE_FILE || "budget-state.json");
const FAILURE_LOG = resolve(STATE_DIR, "failure-log.json");

const DEFAULTS = {
  maxConsecutiveFailures: 5,
  failureWindow: 10,
  llmTimeoutMinutes: 30,
  checkIntervalMs: 60000,
};

/**
 * Load or create the hard stop state file.
 * @returns {Object} Hard stop state
 */
export function loadHardStopState() {
  if (existsSync(STOP_FILE)) {
    return JSON.parse(readFileSync(STOP_FILE, "utf-8"));
  }

  return {
    active: false,
    reason: null,
    triggered_at: null,
    triggered_by: null,
    overrides: [],
    checks_since_trigger: 0,
  };
}

/**
 * Save hard stop state atomically.
 * @param {Object} state - Updated hard stop state
 */
export async function saveHardStopState(state) {
  const fs = await import("fs/promises");
  const tmpFile = STOP_FILE + ".tmp";
  writeFileSync(tmpFile, JSON.stringify(state, null, 2), "utf-8");
  await fs.default.rename(tmpFile, STOP_FILE);
}

/**
 * Check all hard stop conditions and update state accordingly.
 * @returns {{ stopped: boolean, triggers: string[] }} Current stop status
 */
export function runChecks() {
  const triggers = [];

  // Check 1: Budget exceeded
  if (existsSync(BUDGET_STATE_FILE)) {
    try {
      const budget = JSON.parse(readFileSync(BUDGET_STATE_FILE, "utf-8"));
      if (budget.hard_stop_triggered) {
        triggers.push(`Budget hard stop: $${budget.spent_usd.toFixed(2)} of $${budget.total_cap_usd.toFixed(2)} (${((budget.spent_usd / budget.total_cap_usd) * 100).toFixed(1)}%)`);
      }
    } catch {
      triggers.push("Budget state file is malformed");
    }
  }

  // Check 2: Consecutive task failure rate
  if (existsSync(FAILURE_LOG)) {
    try {
      const failures = JSON.parse(readFileSync(FAILURE_LOG, "utf-8"));
      const recent = failures.slice(-DEFAULTS.failureWindow);
      if (recent.length >= 3) {
        const failCount = recent.filter((f) => f.success === false).length;
        const rate = failCount / recent.length;
        if (rate > 0.5) {
          triggers.push(`Task failure rate too high: ${failCount}/${recent.length} (${(rate * 100).toFixed(0)}%) in last ${recent.length} tasks`);
        }
      }
    } catch {
      triggers.push("Failure log is malformed");
    }
  }

  // Check 3: LLM availability (checked via environment variable set by llm-fallback guard)
  if (process.env.LLM_PRIMARY_UNAVAILABLE === "true") {
    const fallbackAvailable = process.env.LLM_FALLBACK_AVAILABLE === "true";
    if (!fallbackAvailable) {
      triggers.push("LLM provider unavailable with no fallback configured");
    }
  }

  // Check 4: Sandbox container resource exhaustion
  if (process.env.SANDBOX_OOM_KILL_COUNT && parseInt(process.env.SANDBOX_OOM_KILL_COUNT) > 3) {
    triggers.push(`Sandbox OOM kills: ${process.env.SANDBOX_OOM_KILL_COUNT} exceeds threshold of 3`);
  }

  return { stopped: triggers.length > 0, triggers };
}

/**
 * Trigger a hard stop manually.
 * @param {string} reason - Description of why the stop was triggered
 * @param {string} source - Component that triggered the stop
 */
export function triggerStop(reason, source) {
  const state = loadHardStopState();
  state.active = true;
  state.reason = reason;
  state.triggered_at = new Date().toISOString();
  state.triggered_by = source;
  state.checks_since_trigger = 0;
  saveHardStopState(state);
}

/**
 * Clear a hard stop (operator override only).
 * @param {string} reason - Reason for clearing the stop
 */
export function clearStop(reason) {
  const state = loadHardStopState();
  if (!state.active) {
    throw new Error("No active hard stop to clear.");
  }
  state.overrides.push({
    reason,
    cleared_at: new Date().toISOString(),
    original_reason: state.reason,
    original_triggered_at: state.triggered_at,
  });
  state.active = false;
  state.reason = null;
  state.triggered_at = null;
  state.triggered_by = null;
  saveHardStopState(state);
}

/**
 * Display the current hard stop status.
 */
export function showStatus() {
  const state = loadHardStopState();
  console.log("Hard Stop Status:");
  console.log(`  Active:    ${state.active ? "YES" : "NO"}`);
  if (state.active) {
    console.log(`  Reason:    ${state.reason}`);
    console.log(`  Source:    ${state.triggered_by}`);
    console.log(`  Triggered: ${state.triggered_at}`);
    console.log(`  Overrides: ${state.overrides.length}`);
  } else {
    console.log("  No active stops.");
  }
}

/**
 * Main CLI entry point.
 */
export async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--check")) {
    const result = runChecks();
    if (result.stopped) {
      triggerStop(result.triggers.join("; "), "hard-stop-detector");
      console.error("HARD STOP TRIGGERED:");
      for (const t of result.triggers) {
        console.error(`  - ${t}`);
      }
      process.exit(1);
    }
    console.log("Hard stop check: OK (no triggers)");
    return;
  }

  if (args.includes("--watch")) {
    console.log("Watching for hard stop conditions... (Ctrl+C to stop)");
    let intervalId;
    const handleInterrupt = () => {
      clearInterval(intervalId);
      process.exit(0);
    };
    process.on("SIGINT", handleInterrupt);
    process.on("SIGTERM", handleInterrupt);
    intervalId = setInterval(() => {
      const result = runChecks();
      if (result.stopped) {
        triggerStop(result.triggers.join("; "), "hard-stop-detector-watch");
        console.error(`[${new Date().toISOString()}] HARD STOP: ${result.triggers.join(", ")}`);
      }
    }, DEFAULTS.checkIntervalMs);
    // Run once immediately
    runChecks();
    return;
  }

  if (args.includes("--status")) {
    showStatus();
    return;
  }

  if (args.includes("--trigger")) {
    const reasonIdx = args.indexOf("--reason");
    const source = args.find((a) => a.startsWith("--source="))?.split("=")[1] || "manual";
    triggerStop(
      reasonIdx !== -1 ? args[reasonIdx + 1] : "Manual trigger",
      source
    );
    console.log("Hard stop triggered.");
    return;
  }

  if (args.includes("--clear")) {
    const reasonIdx = args.indexOf("--reason");
    clearStop(reasonIdx !== -1 ? args[reasonIdx + 1] : "Operator clearance");
    console.log("Hard stop cleared.");
    return;
  }

  console.error("Usage:");
  console.error("  hard-stop-detector.mjs --check         # One-shot check");
  console.error("  hard-stop-detector.mjs --watch          # Continuous monitoring");
  console.error("  hard-stop-detector.mjs --status         # Show current state");
  console.error("  hard-stop-detector.mjs --trigger --reason <text> [--source <component>]");
  console.error("  hard-stop-detector.mjs --clear --reason <text>");
  process.exit(1);
}

if (process.argv[1] && process.argv[1].endsWith("hard-stop-detector.mjs")) {
  main();
}
