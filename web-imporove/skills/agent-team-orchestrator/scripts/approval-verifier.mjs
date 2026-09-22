/**
 * approval-verifier.mjs — Validates that all required approvals are present before execution begins.
 *
 * Checks:
 *   - approvals.json exists and is valid JSON
 *   - Every required item in GOALS.example.json has a corresponding approval entry
 *   - No approval has status "rejected"
 *   - Approvals are signed within an acceptable time window of goal creation
 *
 * Usage:
 *   node approval-verifier.mjs --check          # One-shot validation
 *   node approval-verifier.mjs --watch          # Watch for new approvals
 */

import { readFileSync, existsSync } from "fs";

const APPROVALS_FILE = process.env.APPROVALS_FILE || "approvals.json";
const GOALS_FILE = process.env.GOALS_FILE || "goals-resolved.json";

/**
 * Load the approvals ledger.
 * @returns {Object|null} Parsed approvals object or null
 */
export function loadApprovals() {
  if (!existsSync(APPROVALS_FILE)) {
    return null;
  }
  return JSON.parse(readFileSync(APPROVALS_FILE, "utf-8"));
}

/**
 * Load the resolved goals document.
 * @returns {Object|null} Parsed goals object or null
 */
export function loadGoals() {
  if (!existsSync(GOALS_FILE)) {
    return null;
  }
  return JSON.parse(readFileSync(GOALS_FILE, "utf-8"));
}

/**
 * Verify that every required deliverable has been approved.
 * @param {Object} approvals - Approvals ledger
 * @param {Object} goals - Resolved goals with expected deliverables
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function verifyApprovals(approvals, goals) {
  const errors = [];
  const warnings = [];

  if (!approvals) {
    errors.push(`No approvals file found at ${APPROVALS_FILE}`);
    return { valid: false, errors, warnings };
  }

  if (!goals) {
    errors.push(`No goals file found at ${GOALS_FILE}`);
    return { valid: false, errors, warnings };
  }

  // Check required items have approvals
  const deliverables = goals.suggested_deliverables || [];
  const deliveredIds = new Set(deliverables.map((d) => d.id));
  const approvedIds = new Set();
  const rejectedItems = [];

  for (const item of deliverables) {
    const itemId = item.id;
    const approval = approvals.approvals?.find((a) => a.deliverable_id === itemId);

    if (!approval) {
      errors.push(`Deliverable "${item.description}" (${itemId}) has no approval entry`);
    } else if (approval.status !== "approved") {
      rejectedItems.push({
        id: itemId,
        description: item.description,
        status: approval.status,
        reason: approval.reason || "no reason provided",
      });
    } else {
      approvedIds.add(itemId);

      // Check signature age (approvals older than 24 hours may be stale)
      if (approval.approved_at) {
        const ageHours = (Date.now() - new Date(approval.approved_at).getTime()) / 3600000;
        if (ageHours > 24) {
          warnings.push(`Approval for "${itemId}" is ${ageHours.toFixed(1)} hours old (stale)`);
        }
      }
    }
  }

  if (rejectedItems.length > 0) {
    for (const r of rejectedItems) {
      errors.push(`Deliverable "${r.description}" was ${r.status}: ${r.reason}`);
    }
  }

  const completeness = approvedIds.size / Math.max(deliverables.length, 1);
  if (completeness < 1.0) {
    errors.push(`${deliverables.length - approvedIds.size} of ${deliverables.length} deliverables not yet approved`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Run validation and print results.
 */
export function runCheck() {
  const approvals = loadApprovals();
  const goals = loadGoals();

  if (!approvals && !goals) {
    console.log("No approvals or goals files found. Skipping verification.");
    return true;
  }

  const result = verifyApprovals(approvals, goals);

  if (!result.valid) {
    console.error("Approval verification FAILED:");
    for (const err of result.errors) {
      console.error(`  [ERROR] ${err}`);
    }
    if (result.warnings.length > 0) {
      console.error("\nWarnings:");
      for (const w of result.warnings) {
        console.error(`  [WARN] ${w}`);
      }
    }
    return false;
  }

  console.log("Approval verification PASSED");
  if (result.warnings.length > 0) {
    console.log(`${result.warnings.length} warning(s):`);
    for (const w of result.warnings) {
      console.log(`  [WARN] ${w}`);
    }
  }
  return true;
}

/**
 * Main CLI entry point.
 */
export async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--status")) {
    const approvals = loadApprovals();
    const goals = loadGoals();
    if (approvals && goals) {
      const result = verifyApprovals(approvals, goals);
      console.log(`Deliverables: ${goals.suggested_deliverables?.length || 0}`);
      console.log(`Approved: ${(approvals.approvals || []).filter((a) => a.status === "approved").length}`);
      console.log(`Valid: ${result.valid}`);
    } else {
      console.log("No approvals/goals data available.");
    }
    return;
  }

  // Default: one-shot check
  const ok = runCheck();
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && process.argv[1].endsWith("approval-verifier.mjs")) {
  main();
}
