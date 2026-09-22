/**
 * plan-validation.mjs — Validates a plan.json produced by P1 planning phase.
 *
 * Usage:
 *   node plan-validation.mjs --file path/to/plan.json
 *   node plan-validation.mjs --stdin    # Read JSON from stdin
 */

import { readFileSync } from "fs";
import { existsSync } from "fs";

const VALID_PHASES = [
  "P0", "P1",
  "B1-shared-contracts", "B2-services-setup", "B3-orchestrator",
  "B4-memory", "B5-agent-runtime", "B6-git-bridge", "B7-gateway",
  "B8-control-room", "B9-remaining-roles", "B10-observability",
  "B11-tests", "B12-bring-up-report",
];

const VALID_AGENT_ROLES = [
  "designer", "frontend", "backend", "qa", "security", "devops", "reviewer",
];

/**
 * Parse and validate a plan object against the expected schema.
 * @param {Object} plan - The parsed JSON plan object
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
export function validatePlan(plan) {
  const errors = [];

  // Check top-level required fields
  if (!plan || typeof plan !== "object") {
    return { valid: false, errors: ["Plan must be a JSON object"] };
  }

  if (!plan.title || typeof plan.title !== "string" || plan.title.trim().length === 0) {
    errors.push("plan.title: required non-empty string");
  }

  if (!plan.description || typeof plan.description !== "string") {
    errors.push("plan.description: required string");
  }

  if (!plan.phases || !Array.isArray(plan.phases)) {
    errors.push("plan.phases: required array of phase objects");
  } else {
    for (let i = 0; i < plan.phases.length; i++) {
      const phase = plan.phases[i];
      if (!phase.name || typeof phase.name !== "string") {
        errors.push(`plan.phases[${i}].name: required string`);
      } else if (!VALID_PHASES.includes(phase.name)) {
        errors.push(
          `plan.phases[${i}].name "${phase.name}" is not a recognized phase identifier`
        );
      }

      if (!phase.tasks || !Array.isArray(phase.tasks)) {
        errors.push(`plan.phases[${i}].tasks: required array`);
      } else {
        for (let j = 0; j < phase.tasks.length; j++) {
          const task = phase.tasks[j];
          if (!task.id || typeof task.id !== "string") {
            errors.push(`plan.phases[${i}].tasks[${j}].id: required string`);
          }
          if (!task.agent_role || !VALID_AGENT_ROLES.includes(task.agent_role)) {
            errors.push(
              `plan.phases[${i}].tasks[${j}].agent_role "${task.agent_role}" must be one of ${VALID_AGENT_ROLES.join(", ")}`
            );
          }
          if (!task.accepted_criteria || !Array.isArray(task.accepted_criteria)) {
            errors.push(`plan.phases[${i}].tasks[${j}].accepted_criteria: required non-empty array`);
          }
        }
      }
    }
  }

  if (!plan.budget_allocation || typeof plan.budget_allocation !== "object") {
    errors.push("plan.budget_allocation: required object with per-agent caps");
  } else {
    const { total_cap, per_agent } = plan.budget_allocation;
    if (typeof total_cap !== "number" || total_cap <= 0) {
      errors.push("plan.budget_allocation.total_cap: required positive number");
    }
    if (per_agent && typeof per_agent === "object") {
      let sum = 0;
      for (const [role, cap] of Object.entries(per_agent)) {
        if (typeof cap !== "number" || cap < 0) {
          errors.push(`plan.budget_allocation.per_agent.${role}: required non-negative number`);
        } else {
          sum += cap;
        }
      }
      if (sum > total_cap + 0.01) {
        errors.push(
          `plan.budget_allocation.per_agent sum (${sum.toFixed(2)}) exceeds total_cap (${total_cap.toFixed(2)})`
        );
      }
    }
  }

  // Forward compatibility: unknown keys are silently ignored
  return { valid: errors.length === 0, errors };
}

/**
 * Check for DAG cycles in the dependency graph.
 * @param {Object} plan - The plan object with phases array
 * @returns {{ hasCycle: boolean, errors: string[] }}
 */
export function validateDependencyDAG(plan) {
  const errors = [];
  const phaseMap = {};

  if (!plan.phases) {
    return { hasCycle: false, errors: ["No phases defined"] };
  }

  for (const phase of plan.phases) {
    phaseMap[phase.name] = phase.dependencies || [];
  }

  // DFS cycle detection
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = {};
  for (const name of Object.keys(phaseMap)) {
    color[name] = WHITE;
  }

  function dfs(node) {
    color[node] = GRAY;
    const deps = phaseMap[node] || [];
    for (const dep of deps) {
      if (!color.hasOwnProperty(dep)) {
        errors.push(`Phase "${node}" depends on unknown phase "${dep}"`);
        continue;
      }
      if (color[dep] === GRAY) {
        return true; // cycle detected
      }
      if (color[dep] === WHITE) {
        if (dfs(dep)) return true;
      }
    }
    color[node] = BLACK;
    return false;
  }

  for (const name of Object.keys(color)) {
    if (color[name] === WHITE) {
      if (dfs(name)) {
        errors.push(`Dependency cycle detected involving phase "${name}"`);
        break;
      }
    }
  }

  return { hasCycle: errors.length > 0, errors };
}

/**
 * Main CLI entry point.
 */
export async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => a.startsWith("--file="))?.split("=")[1]
    || args.find((a) => a.startsWith("-f="))?.split("=")[1];

  let planJson;
  try {
    if (filePath) {
      if (!existsSync(filePath)) {
        console.error(`Error: file not found: ${filePath}`);
        process.exit(1);
      }
      planJson = JSON.parse(readFileSync(filePath, "utf-8"));
    } else {
      let input = "";
      process.stdin.setEncoding("utf-8");
      for await (const chunk of process.stdin) {
        input += chunk;
      }
      planJson = JSON.parse(input);
    }
  } catch (err) {
    console.error(`Error parsing plan JSON: ${err.message}`);
    process.exit(1);
  }

  const validation = validatePlan(planJson);
  const dagValidation = validateDependencyDAG(planJson);

  let exitCode = 0;
  if (!validation.valid) {
    console.error("Plan validation failed:");
    for (const err of validation.errors) {
      console.error(`  [ERROR] ${err}`);
    }
    exitCode = 1;
  }

  if (dagValidation.hasCycle) {
    console.error("Dependency graph validation failed:");
    for (const err of dagValidation.errors) {
      console.error(`  [ERROR] ${err}`);
    }
    exitCode = 1;
  }

  if (exitCode === 0) {
    console.log("Plan validation: PASS");
    console.log(`  Phases: ${planJson.phases.length}`);
    console.log(`  Total tasks: ${planJson.phases.reduce((s, p) => s + (p.tasks?.length || 0), 0)}`);
    console.log(`  Budget cap: $${planJson.budget_allocation?.total_cap || "N/A"}`);
  }

  process.exit(exitCode);
}

if (process.argv[1] && process.argv[1].endsWith("plan-validation.mjs")) {
  main();
}
